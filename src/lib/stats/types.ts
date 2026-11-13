import type { ReviewDecision } from "../types";

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
  reporterAvatarUrl: string | null;
  labels: string[];
  state: IssueState;
  createdAt: string;
  closedAt: string | null;
  updatedAt: string;
  commentCount: number;
  /** Only populated for currently-open PRs; null otherwise. Currently unused — was the old comment-timing review heuristic's input before `reviewDecision` replaced it. */
  lastCommitAt: string | null;
  /** Only populated for currently-open PRs; null otherwise. Currently unused — was the old comment-timing review heuristic's input before `reviewDecision` replaced it. */
  lastCommentAt: string | null;
  assignees: string[];
  /** Only populated for merged PRs; null for plain issues and for closed-but-not-merged PRs. */
  mergedBy: string | null;
  /** Only populated for merged PRs; null for plain issues and for closed-but-not-merged PRs. */
  mergedAt: string | null;
  /** Only populated for merged PRs; null for plain issues and for closed-but-not-merged PRs. */
  mergedByAvatarUrl: string | null;
  /** GitHub's own review state — only meaningful (and only populated) for currently-open PRs; null otherwise, same as `lastCommitAt`/`lastCommentAt`. */
  reviewDecision: ReviewDecision | null;
}

export interface HistoricalDataset {
  issues: HistoricalIssue[];
  recentCommitAuthors: Array<{ repo: string; author: string }>;
  fetchedAt: string;
}
