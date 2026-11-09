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

const GITHUB_API_BASE = "https://api.github.com/";

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

async function graphqlRequest<T>(token: string, variables: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await readOnlyFetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ query: OPEN_PULL_REQUESTS_QUERY, variables }),
    });

    // Primary (REST-style) and secondary (abuse detection) rate limits both surface as 403/429.
    if (response.status === 403 || response.status === 429) {
      const resetHeader = response.headers.get("x-ratelimit-reset");
      const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000) : new Date(Date.now() + 60_000);
      if (attempt === 0) {
        await sleep(resetAt.getTime() - Date.now());
        continue;
      }
      throw new RateLimitError(`GitHub API rate limit exceeded; resets at ${resetAt.toISOString()}`, resetAt);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${body}`);
    }

    const json = (await response.json()) as GraphQLResponse<T>;
    if (json.errors?.length) {
      throw new Error(`GitHub GraphQL error: ${json.errors.map((error) => error.message).join("; ")}`);
    }

    const rateLimit = (json.data as unknown as { rateLimit?: { remaining: number; resetAt: string; cost: number } })?.rateLimit;
    if (rateLimit && rateLimit.remaining < rateLimit.cost && attempt === 0) {
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
    const data: PullRequestsPage = await graphqlRequest<PullRequestsPage>(config.token, {
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

const MAX_FILE_CONTENT_BYTES = 2_000_000;

interface ContentsResponse {
  content?: string;
  encoding?: string;
  size?: number;
}

/** Fetches a file's content at an exact commit SHA via the REST Contents API. Returns null if missing, too large, or not a regular file. */
export async function getFileContent(config: GitHubConfig, path: string, ref: string): Promise<string | null> {
  const url = `${GITHUB_API_BASE}repos/${config.owner}/${config.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`;
  const response = await readOnlyFetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
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
