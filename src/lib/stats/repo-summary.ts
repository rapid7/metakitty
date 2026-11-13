import type { HistoricalIssue } from "./types";

export type PrReviewStatus = "needs_review" | "changes_requested" | "approved";

/**
 * Maps a PR's own `reviewDecision` (GitHub's authoritative review state) to a 3-way status —
 * replaces an earlier comment-timing heuristic (a port of metakitty's `has_review?`) that
 * mislabeled most unreviewed PRs as "reviewed" just because someone had left any comment on them.
 * Null for `reviewDecision` of `null` (always the case for non-open PRs, since it's only
 * meaningful/populated while open).
 */
export function getPrReviewStatus(issue: HistoricalIssue): PrReviewStatus | null {
  switch (issue.reviewDecision) {
    case "approved":
      return "approved";
    case "changes_requested":
      return "changes_requested";
    case "review_required":
    case "none":
      return "needs_review";
    default:
      return null;
  }
}

export interface PrSummary {
  number: number;
  title: string;
  author: string;
  assignees: string[];
  commentCount: number;
  reviewStatus: PrReviewStatus | null;
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
    reviewStatus: getPrReviewStatus(issue),
    labels: issue.labels,
    url: issue.url,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

/**
 * Groups PRs by repo, split open/closed — the "Metasploit Repositories" page. Sorted by open PR
 * count desc first, not total count: a repo with a handful of PRs awaiting review belongs above
 * one that's merely had more PRs historically but has nothing open right now.
 */
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
  return [...byRepo.values()].sort(
    (a, b) => b.openPrs.length - a.openPrs.length || b.totalCount - a.totalCount || a.repo.localeCompare(b.repo)
  );
}
