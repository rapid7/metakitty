import type { HistoricalIssue } from "./types";

/** A PR has been reviewed if it has comments and the last commit is at-or-before the last comment — a direct port of metakitty's `has_review?`. */
export function hasReview(issue: HistoricalIssue): boolean {
  if (issue.commentCount === 0) return false;
  if (!issue.lastCommitAt || !issue.lastCommentAt) return true;
  return Date.parse(issue.lastCommitAt) <= Date.parse(issue.lastCommentAt);
}

export interface PrSummary {
  number: number;
  title: string;
  author: string;
  assignees: string[];
  commentCount: number;
  hasReview: boolean;
  labels: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepoSummary {
  repo: string;
  openPrs: PrSummary[];
  closedPrs: PrSummary[];
  totalCount: number;
}

function toPrSummary(issue: HistoricalIssue): PrSummary {
  return {
    number: issue.number,
    title: issue.title,
    author: issue.reporter,
    assignees: issue.assignees,
    commentCount: issue.commentCount,
    hasReview: hasReview(issue),
    labels: issue.labels,
    url: issue.url,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

/** Groups PRs by repo, split open/closed, sorted by total PR count desc — the "Metasploit Repositories" page. */
export function getRepoSummaries(issues: HistoricalIssue[]): RepoSummary[] {
  const byRepo = new Map<string, RepoSummary>();
  for (const issue of issues) {
    if (!issue.pullRequest) continue;
    let summary = byRepo.get(issue.project);
    if (!summary) {
      summary = { repo: issue.project, openPrs: [], closedPrs: [], totalCount: 0 };
      byRepo.set(issue.project, summary);
    }
    (issue.state === "open" ? summary.openPrs : summary.closedPrs).push(toPrSummary(issue));
    summary.totalCount++;
  }
  for (const summary of byRepo.values()) {
    summary.openPrs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    summary.closedPrs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  return [...byRepo.values()].sort((a, b) => b.totalCount - a.totalCount || a.repo.localeCompare(b.repo));
}
