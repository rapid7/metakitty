import { graphqlRequest } from "../github-client";
import { runInBatches } from "../async";
import { STATS_OWNER } from "./repos";

export interface RawHistoricalIssueNode {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  closedAt: string | null;
  updatedAt: string;
  state: "OPEN" | "CLOSED";
  author: { login: string; avatarUrl: string } | null;
  comments: { totalCount: number };
  assignees: { nodes: Array<{ login: string }> };
  labels: { nodes: Array<{ name: string }> } | null;
}

export interface RawHistoricalPullRequestNode extends Omit<RawHistoricalIssueNode, "state" | "comments"> {
  state: "OPEN" | "CLOSED" | "MERGED";
  comments: { totalCount: number; nodes: Array<{ createdAt: string }> };
  commits: { nodes: Array<{ commit: { committedDate: string } }> };
  mergedBy: { login: string; avatarUrl: string } | null;
  mergedAt: string | null;
}

export type TaggedIssueNode = RawHistoricalIssueNode & { project: string };
export type TaggedPullRequestNode = RawHistoricalPullRequestNode & { project: string };

const REPO_ISSUES_QUERY = `
  query RepoIssues($owner: String!, $repo: String!, $cursor: String) {
    rateLimit { remaining resetAt cost }
    repository(owner: $owner, name: $repo) {
      issues(states: [OPEN, CLOSED], first: 100, after: $cursor, orderBy: { field: CREATED_AT, direction: ASC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number
          title
          url
          createdAt
          closedAt
          updatedAt
          state
          author { login avatarUrl }
          comments { totalCount }
          assignees(first: 10) { nodes { login } }
          labels(first: 20) { nodes { name } }
        }
      }
    }
  }
`;

const PULL_REQUEST_FIELDS = `
  number
  title
  url
  createdAt
  closedAt
  updatedAt
  state
  author { login avatarUrl }
  comments(last: 1) { totalCount nodes { createdAt } }
  assignees(first: 10) { nodes { login } }
  labels(first: 20) { nodes { name } }
  commits(last: 1) { nodes { commit { committedDate } } }
  mergedBy { login avatarUrl }
  mergedAt
`;

const REPO_PULL_REQUESTS_QUERY = `
  query RepoPullRequests($owner: String!, $repo: String!, $cursor: String) {
    rateLimit { remaining resetAt cost }
    repository(owner: $owner, name: $repo) {
      pullRequests(states: [OPEN, CLOSED, MERGED], first: 100, after: $cursor, orderBy: { field: CREATED_AT, direction: ASC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          ${PULL_REQUEST_FIELDS}
        }
      }
    }
  }
`;

/**
 * Issues updated at or after `$since` — unlike {@link REPO_ISSUES_QUERY}'s full-history scan, this
 * is the incremental top-up used once a repo already has a `data/history/` baseline: anything
 * genuinely new necessarily has `updatedAt >= createdAt > since`, and anything whose state/labels/
 * comments changed since `since` is picked up too. `IssueFilters.since` is a confirmed field on
 * GitHub's schema (verified via introspection), unlike `pullRequests`, which has no such filter —
 * see {@link REPO_PULL_REQUESTS_SINCE_QUERY} for how PRs get the equivalent treatment.
 */
const REPO_ISSUES_SINCE_QUERY = `
  query RepoIssuesSince($owner: String!, $repo: String!, $since: DateTime!, $cursor: String) {
    rateLimit { remaining resetAt cost }
    repository(owner: $owner, name: $repo) {
      issues(states: [OPEN, CLOSED], filterBy: { since: $since }, first: 100, after: $cursor, orderBy: { field: CREATED_AT, direction: ASC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number
          title
          url
          createdAt
          closedAt
          updatedAt
          state
          author { login avatarUrl }
          comments { totalCount }
          assignees(first: 10) { nodes { login } }
          labels(first: 20) { nodes { name } }
        }
      }
    }
  }
`;

/**
 * The `pullRequests` connection has no `since`/updated-at filter (confirmed via introspection), so
 * the incremental top-up instead uses GitHub's `search` (which treats PRs as a kind of issue and
 * does support an `updated:` date qualifier). Date-only granularity, not a timestamp — slightly
 * over-fetches (anything updated earlier that same day), which is harmless since the merge in
 * dataset.ts is by (repo, number) and idempotent.
 */
const REPO_PULL_REQUESTS_SINCE_QUERY = `
  query RepoPullRequestsSince($query: String!, $cursor: String) {
    rateLimit { remaining resetAt cost }
    search(query: $query, type: ISSUE, first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on PullRequest {
          ${PULL_REQUEST_FIELDS}
        }
      }
    }
  }
`;

const REPO_RECENT_COMMITS_QUERY = `
  query RepoRecentCommits($owner: String!, $repo: String!, $since: GitTimestamp!, $cursor: String) {
    rateLimit { remaining resetAt cost }
    repository(owner: $owner, name: $repo) {
      defaultBranchRef {
        target {
          ... on Commit {
            history(since: $since, first: 100, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes {
                author { user { login } name }
              }
            }
          }
        }
      }
    }
  }
`;

interface IssuesPage {
  repository: { issues: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawHistoricalIssueNode[] } } | null;
}

interface PullRequestsPage {
  repository: { pullRequests: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawHistoricalPullRequestNode[] } } | null;
}

interface CommitsPage {
  repository: {
    defaultBranchRef: {
      target: { history: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Array<{ author: { user: { login: string } | null; name: string | null } }> } } | null;
    } | null;
  } | null;
}

interface SearchPullRequestsPage {
  search: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Array<RawHistoricalPullRequestNode | Record<string, never>> };
}

/** Pages logged at this interval so a big repo (metasploit-framework can run 100+ pages) doesn't look stalled. */
const PAGE_LOG_INTERVAL = 20;

export async function fetchRepoIssues(token: string, repo: string): Promise<RawHistoricalIssueNode[]> {
  const nodes: RawHistoricalIssueNode[] = [];
  let cursor: string | null = null;
  let page = 0;
  while (true) {
    const data: IssuesPage = await graphqlRequest<IssuesPage>(token, REPO_ISSUES_QUERY, { owner: STATS_OWNER, repo, cursor });
    if (!data.repository) break;
    nodes.push(...data.repository.issues.nodes);
    page++;
    if (page % PAGE_LOG_INTERVAL === 0) {
      console.log(`[stats]   ${STATS_OWNER}/${repo} issues: page ${page}, ${nodes.length} fetched so far...`);
    }
    const { hasNextPage, endCursor } = data.repository.issues.pageInfo;
    if (!hasNextPage) break;
    cursor = endCursor;
  }
  return nodes;
}

export async function fetchRepoPullRequests(token: string, repo: string): Promise<RawHistoricalPullRequestNode[]> {
  const nodes: RawHistoricalPullRequestNode[] = [];
  let cursor: string | null = null;
  let page = 0;
  while (true) {
    const data: PullRequestsPage = await graphqlRequest<PullRequestsPage>(token, REPO_PULL_REQUESTS_QUERY, { owner: STATS_OWNER, repo, cursor });
    if (!data.repository) break;
    nodes.push(...data.repository.pullRequests.nodes);
    page++;
    if (page % PAGE_LOG_INTERVAL === 0) {
      console.log(`[stats]   ${STATS_OWNER}/${repo} pull requests: page ${page}, ${nodes.length} fetched so far...`);
    }
    const { hasNextPage, endCursor } = data.repository.pullRequests.pageInfo;
    if (!hasNextPage) break;
    cursor = endCursor;
  }
  return nodes;
}

/** Issues updated at/after `sinceIso` — the incremental counterpart to {@link fetchRepoIssues}, used once a repo already has a `data/history/` baseline. */
export async function fetchRepoIssuesSince(token: string, repo: string, sinceIso: string): Promise<RawHistoricalIssueNode[]> {
  const nodes: RawHistoricalIssueNode[] = [];
  let cursor: string | null = null;
  while (true) {
    const data: IssuesPage = await graphqlRequest<IssuesPage>(token, REPO_ISSUES_SINCE_QUERY, { owner: STATS_OWNER, repo, since: sinceIso, cursor });
    if (!data.repository) break;
    nodes.push(...data.repository.issues.nodes);
    const { hasNextPage, endCursor } = data.repository.issues.pageInfo;
    if (!hasNextPage) break;
    cursor = endCursor;
  }
  return nodes;
}

/** PRs updated at/after `sinceIso` — the incremental counterpart to {@link fetchRepoPullRequests}, via `search` since the `pullRequests` connection has no date filter (see {@link REPO_PULL_REQUESTS_SINCE_QUERY}). */
export async function fetchRepoPullRequestsSince(token: string, repo: string, sinceIso: string): Promise<RawHistoricalPullRequestNode[]> {
  const sinceDate = sinceIso.slice(0, 10);
  const query = `repo:${STATS_OWNER}/${repo} is:pr updated:>=${sinceDate}`;
  const nodes: RawHistoricalPullRequestNode[] = [];
  let cursor: string | null = null;
  while (true) {
    const data: SearchPullRequestsPage = await graphqlRequest<SearchPullRequestsPage>(token, REPO_PULL_REQUESTS_SINCE_QUERY, { query, cursor });
    for (const node of data.search.nodes) {
      if (typeof node.number === "number") nodes.push(node as RawHistoricalPullRequestNode);
    }
    const { hasNextPage, endCursor } = data.search.pageInfo;
    if (!hasNextPage) break;
    cursor = endCursor;
  }
  return nodes;
}

/** Commit author (login, falling back to the git author name for authors without a GitHub account) since `sinceIso`. */
export async function fetchRepoRecentCommits(token: string, repo: string, sinceIso: string): Promise<string[]> {
  const authors: string[] = [];
  let cursor: string | null = null;
  while (true) {
    const data: CommitsPage = await graphqlRequest<CommitsPage>(token, REPO_RECENT_COMMITS_QUERY, { owner: STATS_OWNER, repo, since: sinceIso, cursor });
    const history = data.repository?.defaultBranchRef?.target?.history;
    if (!history) break;
    for (const node of history.nodes) {
      const author = node.author.user?.login ?? node.author.name;
      if (author) authors.push(author);
    }
    if (!history.pageInfo.hasNextPage) break;
    cursor = history.pageInfo.endCursor;
  }
  return authors;
}

export interface RepoHistoriesResult {
  issues: TaggedIssueNode[];
  pullRequests: TaggedPullRequestNode[];
}

/**
 * Shared batching/logging behind {@link fetchAllRepoHistories} (full history) and
 * {@link fetchAllRepoHistoriesSince} (incremental top-up) — they differ only in which per-repo
 * issue/PR fetchers they plug in. A repo that errors (renamed/archived/deleted/rate-limited past
 * retry) is skipped with a warning rather than failing the whole build — this hardcoded repo list
 * dates back to metakitty and some entries may no longer exist.
 */
async function fetchAllRepoHistoriesWith(
  repos: string[],
  options: { concurrency?: number },
  token: string,
  fetchIssues: (token: string, repo: string) => Promise<RawHistoricalIssueNode[]>,
  fetchPullRequests: (token: string, repo: string) => Promise<RawHistoricalPullRequestNode[]>
): Promise<RepoHistoriesResult> {
  const concurrency = options.concurrency ?? 4;
  const issues: TaggedIssueNode[] = [];
  const pullRequests: TaggedPullRequestNode[] = [];
  const total = repos.length;
  let completed = 0;
  const startedAt = Date.now();

  console.log(`[stats] Fetching issue/PR history for ${total} repos (concurrency ${concurrency})...`);

  await runInBatches(repos, concurrency, async (repo) => {
    const repoStartedAt = Date.now();
    try {
      const [issueNodes, prNodes] = await Promise.all([fetchIssues(token, repo), fetchPullRequests(token, repo)]);
      for (const node of issueNodes) issues.push({ ...node, project: repo });
      for (const node of prNodes) pullRequests.push({ ...node, project: repo });
      completed++;
      const elapsedSeconds = ((Date.now() - repoStartedAt) / 1000).toFixed(1);
      console.log(`[stats] (${completed}/${total}) ${STATS_OWNER}/${repo}: ${issueNodes.length} issues, ${prNodes.length} PRs (${elapsedSeconds}s)`);
    } catch (error) {
      completed++;
      console.warn(`[stats] (${completed}/${total}) Skipping ${STATS_OWNER}/${repo}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  const totalElapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[stats] Finished fetching ${total} repos in ${totalElapsedSeconds}s: ${issues.length} issues, ${pullRequests.length} PRs.`);

  return { issues, pullRequests };
}

/** Fetches full issue + PR history for every repo in `repos`, with bounded concurrency — used for a repo with no `data/history/` baseline yet. */
export async function fetchAllRepoHistories(token: string, repos: string[], options: { concurrency?: number } = {}): Promise<RepoHistoriesResult> {
  return fetchAllRepoHistoriesWith(repos, options, token, fetchRepoIssues, fetchRepoPullRequests);
}

/** Fetches only the issue/PR delta since `sinceIso` for every repo in `repos` — the incremental top-up for a repo that already has a `data/history/` baseline. */
export async function fetchAllRepoHistoriesSince(
  token: string,
  repos: string[],
  sinceIso: string,
  options: { concurrency?: number } = {}
): Promise<RepoHistoriesResult> {
  return fetchAllRepoHistoriesWith(
    repos,
    options,
    token,
    (t, repo) => fetchRepoIssuesSince(t, repo, sinceIso),
    (t, repo) => fetchRepoPullRequestsSince(t, repo, sinceIso)
  );
}

/**
 * Fetches recent commit authors (within `commitsSinceIso`) for every repo in `repos`, with bounded
 * concurrency. Unlike issue/PR history, this is a cheap, bounded rolling window with no value in
 * being incrementally merged against a committed baseline — see `src/lib/stats/recent-commits-cache.ts`
 * for how the caller (`dataset.ts`) caches it instead, in the gitignored `.cache/`.
 */
export async function fetchAllRepoRecentCommits(
  token: string,
  repos: string[],
  commitsSinceIso: string,
  concurrency = 4
): Promise<Array<{ repo: string; author: string }>> {
  const recentCommitAuthors: Array<{ repo: string; author: string }> = [];
  const total = repos.length;
  let completed = 0;

  console.log(`[stats] Fetching recent commit history for ${total} repos (concurrency ${concurrency})...`);

  await runInBatches(repos, concurrency, async (repo) => {
    try {
      const authors = await fetchRepoRecentCommits(token, repo, commitsSinceIso);
      for (const author of authors) recentCommitAuthors.push({ repo, author });
      completed++;
    } catch (error) {
      completed++;
      console.warn(`[stats] (${completed}/${total}) Skipping recent commits for ${STATS_OWNER}/${repo}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  console.log(`[stats] Finished fetching recent commits for ${total} repos: ${recentCommitAuthors.length} commit-author records.`);
  return recentCommitAuthors;
}
