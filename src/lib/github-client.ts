const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

export class ReadOnlyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadOnlyViolationError";
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public resetAt: Date) {
    super(message);
    this.name = "RateLimitError";
  }
}

/** Thrown by {@link restGet}/{@link restGetAllPages} on a 404 — callers fetching across many repos should catch this and skip just that repo. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export const GITHUB_API_BASE = "https://api.github.com/";

/** Defense-in-depth: this dashboard only ever reads data, either a GraphQL query or a plain GET against GitHub's REST API. */
async function readOnlyFetch(url: string, init: RequestInit): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  if (url === GITHUB_GRAPHQL_URL) {
    if (method !== "POST") throw new ReadOnlyViolationError(`Blocked non-POST GraphQL request: ${method} ${url}`);
    validateGraphQLQuery(typeof init.body === "string" ? init.body : "");
  } else if (method !== "GET" || !url.startsWith(GITHUB_API_BASE)) {
    throw new ReadOnlyViolationError(`Blocked non-read request: ${method} ${url}`);
  }
  return fetch(url, init);
}

function validateGraphQLQuery(body: string): void {
  let parsed: { query?: string };
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ReadOnlyViolationError("Invalid GraphQL request body: could not parse JSON");
  }
  const stripped = (parsed.query ?? "").replace(/#[^\n]*/g, "").trim();
  if (/\bmutation\b/i.test(stripped)) {
    throw new ReadOnlyViolationError("GraphQL mutation blocked: only query operations are permitted");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/** Transient infra errors (e.g. a brief GitHub outage) — worth retrying, unlike a genuine client error (404, bad query, etc). */
const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

function retryDelayMs(attempt: number): number {
  return Math.min(INITIAL_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

/** Runs `fetch` via `readOnlyFetch`, retrying with exponential backoff on a transient 5xx status or a network-level failure (DNS, reset, timeout). Rethrows a `ReadOnlyViolationError` immediately — that's a safety guard, not a transient condition. */
async function fetchWithRetry(url: string, init: RequestInit, attempt: number): Promise<Response | null> {
  // A failed attempt's pooled keep-alive connection can be left in a bad state (e.g. a desynced
  // chunked-encoding frame) that keeps producing broken — sometimes entirely empty — responses on
  // every subsequent request that reuses it. `Connection: close` forces a fresh connection for any
  // retry, rather than retrying onto the same bad socket indefinitely.
  const requestInit = attempt > 0 ? { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Connection: "close" } } : init;
  let response: Response;
  try {
    response = await readOnlyFetch(url, requestInit);
  } catch (error) {
    if (error instanceof ReadOnlyViolationError) throw error;
    if (attempt >= MAX_RETRIES) throw error;
    await sleep(retryDelayMs(attempt));
    return null;
  }
  if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
    await sleep(retryDelayMs(attempt));
    return null;
  }
  return response;
}

export interface RawPullRequestNode {
  number: number;
  title: string;
  body: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: { login: string; avatarUrl: string } | null;
  comments: { totalCount: number };
  assignees: { nodes: Array<{ login: string; avatarUrl: string }> };
  labels: { nodes: Array<{ name: string; color: string }> } | null;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  files: { nodes: Array<{ path: string }> } | null;
  commits: { nodes: Array<{ commit: { oid: string; statusCheckRollup: { state: string } | null } }> };
}

const OPEN_PULL_REQUESTS_QUERY = `
  query OpenPullRequests($owner: String!, $repo: String!, $cursor: String) {
    rateLimit { remaining resetAt cost }
    repository(owner: $owner, name: $repo) {
      pullRequests(states: OPEN, first: 50, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number
          title
          body
          url
          createdAt
          updatedAt
          author { login avatarUrl }
          comments { totalCount }
          assignees(first: 10) { nodes { login avatarUrl } }
          labels(first: 20) { nodes { name color } }
          reviewDecision
          additions
          deletions
          changedFiles
          files(first: 100) { nodes { path } }
          commits(last: 1) { nodes { commit { oid statusCheckRollup { state } } } }
        }
      }
    }
  }
`;

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function graphqlRequest<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetchWithRetry(
      GITHUB_GRAPHQL_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ query, variables }),
      },
      attempt
    );
    if (!response) continue;

    // Primary (REST-style) and secondary (abuse detection) rate limits both surface as 403/429.
    if (response.status === 403 || response.status === 429) {
      const resetHeader = response.headers.get("x-ratelimit-reset");
      const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000) : new Date(Date.now() + 60_000);
      if (attempt < MAX_RETRIES) {
        await sleep(resetAt.getTime() - Date.now());
        continue;
      }
      throw new RateLimitError(`GitHub API rate limit exceeded; resets at ${resetAt.toISOString()}`, resetAt);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${body}`);
    }

    // A response can be `.ok` with a fully-sent status line yet still have its body cut short by
    // a dropped connection partway through streaming a large page — `.json()` then throws a
    // SyntaxError that, unlike the status-code checks above, isn't naturally covered by the
    // retry loop. Treat it the same as a transient 5xx rather than letting it escape and fail the
    // whole repo.
    let json: GraphQLResponse<T>;
    try {
      json = (await response.json()) as GraphQLResponse<T>;
    } catch (error) {
      if (attempt >= MAX_RETRIES) throw error;
      await sleep(retryDelayMs(attempt));
      continue;
    }
    if (json.errors?.length) {
      throw new Error(`GitHub GraphQL error: ${json.errors.map((error) => error.message).join("; ")}`);
    }

    const rateLimit = (json.data as unknown as { rateLimit?: { remaining: number; resetAt: string; cost: number } })?.rateLimit;
    if (rateLimit && rateLimit.remaining < rateLimit.cost && attempt < MAX_RETRIES) {
      await sleep(Date.parse(rateLimit.resetAt) - Date.now());
      continue;
    }

    return json.data as T;
  }
  throw new RateLimitError("GitHub API rate limit exceeded after retrying", new Date());
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

interface PullRequestsPage {
  repository: { pullRequests: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawPullRequestNode[] } };
}

export async function fetchOpenPullRequests(config: GitHubConfig): Promise<RawPullRequestNode[]> {
  const nodes: RawPullRequestNode[] = [];
  let cursor: string | null = null;
  while (true) {
    const data: PullRequestsPage = await graphqlRequest<PullRequestsPage>(config.token, OPEN_PULL_REQUESTS_QUERY, {
      owner: config.owner,
      repo: config.repo,
      cursor,
    });
    nodes.push(...data.repository.pullRequests.nodes);
    const { hasNextPage, endCursor } = data.repository.pullRequests.pageInfo;
    if (!hasNextPage) break;
    cursor = endCursor;
  }
  return nodes;
}

const OPEN_PULL_REQUEST_COUNT_QUERY = `
  query OpenPullRequestCount($owner: String!, $repo: String!) {
    rateLimit { remaining resetAt cost }
    repository(owner: $owner, name: $repo) {
      pullRequests(states: OPEN) { totalCount }
    }
  }
`;

interface PullRequestCountPage {
  repository: { pullRequests: { totalCount: number } } | null;
}

/** Just the open PR count for a repo — a single-request, no-pagination counterpart to {@link fetchOpenPullRequests} for callers (e.g. the repo switcher) that only need the number. */
export async function fetchOpenPullRequestCount(config: GitHubConfig): Promise<number> {
  const data = await graphqlRequest<PullRequestCountPage>(config.token, OPEN_PULL_REQUEST_COUNT_QUERY, {
    owner: config.owner,
    repo: config.repo,
  });
  return data.repository?.pullRequests.totalCount ?? 0;
}

interface RestPage<T> {
  data: T;
  nextUrl: string | null;
}

function parseNextLink(header: string | null): string | null {
  if (!header) return null;
  const nextPart = header.split(",").map((part) => part.trim()).find((part) => part.endsWith('rel="next"'));
  if (!nextPart) return null;
  const match = /^<(.+)>/.exec(nextPart);
  return match ? match[1] : null;
}

/** A single paginated GET against GitHub's REST API, with the same rate-limit/transient-5xx retry-with-backoff as {@link graphqlRequest}. Throws {@link NotFoundError} on 404. */
export async function restGet<T>(token: string, url: string): Promise<RestPage<T>> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      attempt
    );
    if (!response) continue;

    if (response.status === 403 || response.status === 429) {
      const resetHeader = response.headers.get("x-ratelimit-reset");
      const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000) : new Date(Date.now() + 60_000);
      if (attempt < MAX_RETRIES) {
        await sleep(resetAt.getTime() - Date.now());
        continue;
      }
      throw new RateLimitError(`GitHub API rate limit exceeded; resets at ${resetAt.toISOString()}`, resetAt);
    }

    if (response.status === 404) throw new NotFoundError(`Not found: ${url}`);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`GitHub REST API error: ${response.status} ${response.statusText} - ${body}`);
    }

    // See the matching comment in graphqlRequest: a truncated body on an otherwise-`.ok` response
    // throws from `.json()` outside the status-code checks above, so it needs its own retry.
    let data: T;
    try {
      data = (await response.json()) as T;
    } catch (error) {
      if (attempt >= MAX_RETRIES) throw error;
      await sleep(retryDelayMs(attempt));
      continue;
    }
    return { data, nextUrl: parseNextLink(response.headers.get("link")) };
  }
  throw new RateLimitError("GitHub API rate limit exceeded after retrying", new Date());
}

/** Pages logged at this interval so a big paginated fetch doesn't look stalled — matches graphqlRequest's GraphQL page-by-page callers in github-history-client.ts. */
const PAGE_LOG_INTERVAL = 20;

/** Follows `Link: rel="next"` pagination to collect every page of a REST array endpoint. When `label` is given, logs progress every {@link PAGE_LOG_INTERVAL} pages. */
export async function restGetAllPages<T>(token: string, initialUrl: string, label?: string): Promise<T[]> {
  const results: T[] = [];
  let url: string | null = initialUrl;
  let pageNumber = 0;
  while (url) {
    const page: RestPage<T[]> = await restGet<T[]>(token, url);
    results.push(...page.data);
    pageNumber++;
    if (label && pageNumber % PAGE_LOG_INTERVAL === 0) {
      console.log(`[stats]   ${label}: page ${pageNumber}, ${results.length} fetched so far...`);
    }
    url = page.nextUrl;
  }
  return results;
}

const MAX_FILE_CONTENT_BYTES = 2_000_000;

interface ContentsResponse {
  content?: string;
  encoding?: string;
  size?: number;
}

/** Fetches a file's content at an exact commit SHA via the REST Contents API. Returns null if missing, too large, or not a regular file. */
export async function getFileContent(config: GitHubConfig, path: string, ref: string): Promise<string | null> {
  const url = `${GITHUB_API_BASE}repos/${config.owner}/${config.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      attempt
    );
    if (!response) continue;

    if (response.status === 404) return null;
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`GitHub Contents API error: ${response.status} ${response.statusText} - ${body}`);
    }
    const data = (await response.json()) as ContentsResponse;
    if (typeof data.size === "number" && data.size > MAX_FILE_CONTENT_BYTES) return null;
    if (!data.content || data.encoding !== "base64") return null;
    return Buffer.from(data.content, "base64").toString("utf8");
  }
  throw new Error(`GitHub Contents API error: exhausted retries fetching ${url}`);
}

/**
 * Fetches a file's content at an exact ref via the REST Contents API's raw media type, which
 * serves files up to 100MB directly (no base64/JSON wrapper) — unlike {@link getFileContent},
 * which is capped at {@link MAX_FILE_CONTENT_BYTES} by the base64-in-JSON response format.
 * Returns null if missing.
 */
export async function getRawFileContent(config: GitHubConfig, path: string, ref: string): Promise<string | null> {
  const url = `${GITHUB_API_BASE}repos/${config.owner}/${config.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/vnd.github.raw+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      attempt
    );
    if (!response) continue;

    if (response.status === 404) return null;
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`GitHub Contents API error: ${response.status} ${response.statusText} - ${body}`);
    }
    return await response.text();
  }
  throw new Error(`GitHub Contents API error: exhausted retries fetching ${url}`);
}
