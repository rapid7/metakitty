import type { HistoricalIssue } from "./types";

export interface NewbieIssue {
  number: number;
  title: string;
  reporter: string;
  url: string;
  project: string;
  createdAt: string;
}

/** Open issues labeled "newbie-friendly" across all repos — metakitty's `issues_newbie.json`. Derived from the already-fetched history, no extra fetch needed. */
export function getNewbieFriendlyIssues(issues: HistoricalIssue[], limit = 10): NewbieIssue[] {
  return issues
    .filter((issue) => !issue.pullRequest && issue.state === "open" && issue.labels.includes("newbie-friendly"))
    .slice(0, limit)
    .map((issue) => ({ number: issue.number, title: issue.title, reporter: issue.reporter, url: issue.url, project: issue.project, createdAt: issue.createdAt }));
}
