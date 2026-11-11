import type { HistoricalIssue } from "./types";

const THIRTY_DAYS_MS = 30 * 86_400_000;

export interface MergedPr {
  number: number;
  title: string;
  author: string;
  url: string;
  project: string;
  labels: string[];
  closedAt: string;
}

/** PRs across all repos closed in the last 30 days, most-recent first — metakitty's `commits_merged.json`. Derived from the already-fetched history, no extra fetch needed. */
export function getRecentlyMergedPrs(issues: HistoricalIssue[], limit = 6, now: number = Date.now()): MergedPr[] {
  const cutoff = now - THIRTY_DAYS_MS;
  return issues
    .filter((issue) => issue.pullRequest && issue.closedAt && Date.parse(issue.closedAt) >= cutoff && Date.parse(issue.closedAt) <= now)
    .sort((a, b) => Date.parse(b.closedAt!) - Date.parse(a.closedAt!))
    .slice(0, limit)
    .map((issue) => ({ number: issue.number, title: issue.title, author: issue.reporter, url: issue.url, project: issue.project, labels: issue.labels, closedAt: issue.closedAt! }));
}
