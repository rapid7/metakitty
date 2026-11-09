import { isRapid7 } from "../queue-filter";
import type { HistoricalIssue } from "./types";

const WEEK_MS = 7 * 86_400_000;
const SERIES_START_MS = Date.parse("2011-01-01T00:00:00Z");

/** Direct port of metakitty's `count_open_on_date` per-issue predicate. */
export function isOpenOn(issue: HistoricalIssue, dateMs: number): boolean {
  const createdAt = Date.parse(issue.createdAt);
  const closedAt = issue.closedAt ? Date.parse(issue.closedAt) : null;
  return createdAt <= dateMs && (closedAt === null || closedAt >= dateMs);
}

export interface SteadyStatePoint {
  date: string;
  all: number;
  rapid7: number;
}

/**
 * Weekly-sampled open-issue count from 2011-01-01 to `now`, split all-vs-Rapid7. Unlike metakitty
 * (which drops zero-count points independently per Highcharts series), every sampled point is kept
 * here so the two lines stay aligned on one shared x-axis in a row-per-date chart format.
 */
export function getSteadyStateSeries(issues: HistoricalIssue[], matches: (issue: HistoricalIssue) => boolean, now: number = Date.now()): SteadyStatePoint[] {
  const matching = issues.filter(matches);
  const points: SteadyStatePoint[] = [];
  for (let dateMs = SERIES_START_MS; dateMs <= now; dateMs += WEEK_MS) {
    let all = 0;
    let rapid7 = 0;
    for (const issue of matching) {
      if (!isOpenOn(issue, dateMs)) continue;
      all++;
      if (isRapid7(issue.reporter)) rapid7++;
    }
    points.push({ date: new Date(dateMs).toISOString(), all, rapid7 });
  }
  return points;
}
