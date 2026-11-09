import type { HistoricalIssue } from "./types";

const WEEK_MS = 7 * 86_400_000;

export interface WeeklyNewItem {
  number: number;
  title: string;
  createdAt: string;
  reporter: string;
  url: string;
  project: string;
}

/** Items matching `category` created in the last 7 days, newest first — drives both the nav "N since last week" badges and the accordion. */
export function getWeeklyNewItems(issues: HistoricalIssue[], matches: (issue: HistoricalIssue) => boolean, now: number = Date.now()): WeeklyNewItem[] {
  const weekAgo = now - WEEK_MS;
  return issues
    .filter((issue) => matches(issue) && Date.parse(issue.createdAt) >= weekAgo && Date.parse(issue.createdAt) <= now)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((issue) => ({ number: issue.number, title: issue.title, createdAt: issue.createdAt, reporter: issue.reporter, url: issue.url, project: issue.project }));
}
