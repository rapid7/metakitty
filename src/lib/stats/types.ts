export type IssueState = "open" | "closed";

/** A single issue or PR, from any repo in STATS_REPOS, across its full history. Mirrors metakitty's `Issue`. */
export interface HistoricalIssue {
  number: number;
  /** Repo name within STATS_OWNER, e.g. "metasploit-framework". */
  project: string;
  pullRequest: boolean;
  title: string;
  url: string;
  reporter: string;
  labels: string[];
  state: IssueState;
  createdAt: string;
  closedAt: string | null;
  updatedAt: string;
  commentCount: number;
  /** Only populated for currently-open PRs (used for has-review detection); null otherwise. */
  lastCommitAt: string | null;
  /** Only populated for currently-open PRs (used for has-review detection); null otherwise. */
  lastCommentAt: string | null;
  assignees: string[];
}

export interface HistoricalDataset {
  issues: HistoricalIssue[];
  recentCommitAuthors: Array<{ repo: string; author: string }>;
  fetchedAt: string;
}
