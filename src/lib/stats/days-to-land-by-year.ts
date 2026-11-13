import type { HistoricalIssue } from "./types";
import { DAY_MS } from "./actor-counts";
import { DEFAULT_EXCLUDED } from "./merged-by";

export interface DaysToLandYear {
  year: number;
  count: number;
  averageDays: number;
}

/**
 * Average days from PR creation to merge, grouped by the calendar year it merged in (UTC),
 * excluding the CI bot's merges, sorted chronologically — shows whether PR turnaround time is
 * getting faster or slower over time, as opposed to who's doing the merging.
 */
export function getDaysToLandByYear(issues: HistoricalIssue[], excluded: string[] = DEFAULT_EXCLUDED): DaysToLandYear[] {
  const totalDays = new Map<number, number>();
  const counts = new Map<number, number>();
  for (const issue of issues) {
    if (!issue.pullRequest || !issue.mergedBy || !issue.mergedAt) continue;
    if (excluded.includes(issue.mergedBy)) continue;
    const mergedMs = Date.parse(issue.mergedAt);
    const year = new Date(mergedMs).getUTCFullYear();
    const days = (mergedMs - Date.parse(issue.createdAt)) / DAY_MS;
    totalDays.set(year, (totalDays.get(year) ?? 0) + days);
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([year, count]) => ({ year, count, averageDays: totalDays.get(year)! / count }))
    .sort((a, b) => a.year - b.year);
}
