import { isRapid7 } from "../queue-filter";
import type { HistoricalIssue } from "./types";

const QUARTERS_LOOKBACK = 16; // 4 years

export interface QuarterlyPoint {
  start: string;
  end: string;
  opened: number;
  closed: number;
  rapid7Opened: number;
  rapid7Closed: number;
}

function quarterStart(date: Date): Date {
  const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1));
}

/**
 * Walks the trailing 4 years in quarterly (3-month) steps, ending at the quarter containing `now`
 * (clipped to `now`, not the full quarter boundary, for the current in-progress quarter) — a
 * direct port of metakitty's `step_by_quarter`/`get_quarterly_data`.
 */
export function getQuarterlySeries(issues: HistoricalIssue[], matches: (issue: HistoricalIssue) => boolean, now: number = Date.now()): QuarterlyPoint[] {
  const matching = issues.filter(matches);
  const currentQuarterStart = quarterStart(new Date(now));
  const points: QuarterlyPoint[] = [];

  for (let i = QUARTERS_LOOKBACK - 1; i >= 0; i--) {
    const start = new Date(currentQuarterStart);
    start.setUTCMonth(start.getUTCMonth() - i * 3);
    const fullEnd = new Date(start);
    fullEnd.setUTCMonth(fullEnd.getUTCMonth() + 3);
    const startMs = start.getTime();
    const endMs = Math.min(fullEnd.getTime(), now);

    let opened = 0;
    let closed = 0;
    let rapid7Opened = 0;
    let rapid7Closed = 0;
    for (const issue of matching) {
      const createdAt = Date.parse(issue.createdAt);
      if (createdAt >= startMs && createdAt < endMs) {
        opened++;
        if (isRapid7(issue.reporter)) rapid7Opened++;
      }
      if (issue.closedAt) {
        const closedAt = Date.parse(issue.closedAt);
        if (closedAt >= startMs && closedAt < endMs) {
          closed++;
          if (isRapid7(issue.reporter)) rapid7Closed++;
        }
      }
    }
    points.push({ start: start.toISOString(), end: new Date(endMs).toISOString(), opened, closed, rapid7Opened, rapid7Closed });
  }
  return points;
}
