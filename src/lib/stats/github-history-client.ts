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
  author: { login: string } | null;
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
          author { login }
          comments { totalCount }
          assignees(first: 10) { nodes { login } }
          labels(first: 20) { nodes { name } }
        }
      }
    }
  }
`;

const REPO_PULL_REQUESTS_QUERY = `
  query RepoPullRequests($owner: String!, $repo: String!, $cursor: String) {
    rateLimit { remaining resetAt cost }
    repository(owner: $owner, name: $repo) {
      pullRequests(states: [OPEN, CLOSED, MERGED], first: 100, after: $cursor, orderBy: { field: CREATED_AT, direction: ASC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number
          title
          url
          createdAt
          closedAt
          updatedAt
          state
          author { login }
          comments(last: 1) { totalCount nodes { createdAt } }
          assignees(first: 10) { nodes { login } }
          labels(first: 20) { nodes { name } }
          commits(last: 1) { nodes { commit { committedDate } } }
          mergedBy { login avatarUrl }
          mergedAt
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
  recentCommitAuthors: Array<{ repo: string; author: string }>;
}

/**
 * Fetches issue + PR + recent-commit history for every repo in `repos`, with bounded concurrency.
 * A repo that errors (renamed/archived/deleted/rate-limited past retry) is skipped with a warning
 * rather than failing the whole build — this hardcoded repo list dates back to metakitty and some
 * entries may no longer exist.
 */
export async function fetchAllRepoHistories(
  token: string,
  repos: string[],
  options: { concurrency?: number; commitsSinceIso: string }
): Promise<RepoHistoriesResult> {
  const concurrency = options.concurrency ?? 4;
  const issues: TaggedIssueNode[] = [];
  const pullRequests: TaggedPullRequestNode[] = [];
  const recentCommitAuthors: Array<{ repo: string; author: string }> = [];
  const total = repos.length;
  let completed = 0;
  const startedAt = Date.now();

  console.log(`[stats] Fetching issue/PR/commit history for ${total} repos (concurrency ${concurrency})...`);

  await runInBatches(repos, concurrency, async (repo) => {
    const repoStartedAt = Date.now();
    try {
      const [issueNodes, prNodes, commitAuthors] = await Promise.all([
        fetchRepoIssues(token, repo),
        fetchRepoPullRequests(token, repo),
        fetchRepoRecentCommits(token, repo, options.commitsSinceIso),
      ]);
      for (const node of issueNodes) issues.push({ ...node, project: repo });
      for (const node of prNodes) pullRequests.push({ ...node, project: repo });
      for (const author of commitAuthors) recentCommitAuthors.push({ repo, author });
      completed++;
      const elapsedSeconds = ((Date.now() - repoStartedAt) / 1000).toFixed(1);
      console.log(
        `[stats] (${completed}/${total}) ${STATS_OWNER}/${repo}: ${issueNodes.length} issues, ${prNodes.length} PRs, ${commitAuthors.length} recent commits (${elapsedSeconds}s)`
      );
    } catch (error) {
      completed++;
      console.warn(`[stats] (${completed}/${total}) Skipping ${STATS_OWNER}/${repo}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  const totalElapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[stats] Finished fetching ${total} repos in ${totalElapsedSeconds}s: ${issues.length} issues, ${pullRequests.length} PRs, ${recentCommitAuthors.length} commit-author records.`
  );

  return { issues, pullRequests, recentCommitAuthors };
}
