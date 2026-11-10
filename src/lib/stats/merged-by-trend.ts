import type { HistoricalIssue } from "./types";
import { DAY_MS, DEFAULT_EXCLUDED, getMergedByCounts } from "./merged-by";

const TOP_N = 5; // matches the 5 categorical chart color slots (--chart-1..5); the rest render folded into "other"
export const OTHER_KEY = "other";

export type MergedByTimeUnit = "day" | "week" | "month" | "quarter";

function bucketStart(unit: MergedByTimeUnit, date: Date): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  switch (unit) {
    case "day":
      return new Date(Date.UTC(year, month, date.getUTCDate()));
    case "week": {
      const day = new Date(Date.UTC(year, month, date.getUTCDate()));
      day.setUTCDate(day.getUTCDate() - day.getUTCDay());
      return day;
    }
    case "month":
      return new Date(Date.UTC(year, month, 1));
    case "quarter":
      return new Date(Date.UTC(year, Math.floor(month / 3) * 3, 1));
  }
}

function advance(unit: MergedByTimeUnit, date: Date): Date {
  const next = new Date(date);
  switch (unit) {
    case "day":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "week":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "month":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "quarter":
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
  }
  return next;
}

/** Picks a bucket granularity that keeps the chart at a readable bar count regardless of the window's span — a 30-day window shouldn't flatten into one quarter bar, and a multi-year "all time" view shouldn't render hundreds of daily bars. */
function pickUnit(spanMs: number): MergedByTimeUnit {
  const spanDays = spanMs / DAY_MS;
  if (spanDays <= 45) return "day";
  if (spanDays <= 210) return "week";
  if (spanDays <= 800) return "month";
  return "quarter";
}

export interface MergedByTimePoint {
  start: string;
  end: string;
  /** Every merger's raw count for this bucket, keyed by their actual login — not pre-folded into "other". Callers (the chart) decide how to group/display this, e.g. top-5 + other for the default view, or a specific non-top-5 login split out on hover. */
  counts: Record<string, number>;
}

export interface MergedByTimeSeries {
  points: MergedByTimePoint[];
  unit: MergedByTimeUnit;
  /** The top mergers within this series' own window (all-time top 5 when `sinceIso` is omitted), fixed across every point so a login's color/series identity never shifts between buckets. */
  topLogins: string[];
}

/**
 * Merged PRs bucketed over time, from `sinceIso` (or the earliest merge in the data, if omitted)
 * through the current bucket, with the full per-login breakdown kept at every point — the trend-view
 * analog of the queue dashboard's per-assignee creation histogram, bucketed by merge date instead of
 * creation date. Scoped the same way as `getMergedByCounts`/`getMergedByWindows`, so a window's trend
 * chart and its ranking table agree on what counts as "within this window".
 */
export function getMergedByTimeSeries(issues: HistoricalIssue[], sinceIso?: string, now: number = Date.now()): MergedByTimeSeries {
  const topLogins = getMergedByCounts(issues, sinceIso)
    .slice(0, TOP_N)
    .map((c) => c.login);

  const sinceMs = sinceIso ? Date.parse(sinceIso) : null;
  const mergedAtMsValues = issues
    .filter((issue) => issue.pullRequest && issue.mergedBy && issue.mergedAt && !DEFAULT_EXCLUDED.includes(issue.mergedBy))
    .map((issue) => Date.parse(issue.mergedAt!))
    .filter((ms) => sinceMs === null || ms >= sinceMs);

  const rangeStartMs = sinceMs ?? (mergedAtMsValues.length ? Math.min(...mergedAtMsValues) : now);
  const unit = pickUnit(now - rangeStartMs);

  const points: MergedByTimePoint[] = [];
  let cursor = bucketStart(unit, new Date(rangeStartMs));

  while (cursor.getTime() < now) {
    const next = advance(unit, cursor);
    const startMs = cursor.getTime();
    const endMs = Math.min(next.getTime(), now);

    const counts: Record<string, number> = {};
    for (const issue of issues) {
      if (!issue.pullRequest || !issue.mergedBy || !issue.mergedAt) continue;
      if (DEFAULT_EXCLUDED.includes(issue.mergedBy)) continue;
      const mergedAtMs = Date.parse(issue.mergedAt);
      if (mergedAtMs < startMs || mergedAtMs >= endMs) continue;
      if (sinceMs !== null && mergedAtMs < sinceMs) continue;
      counts[issue.mergedBy] = (counts[issue.mergedBy] ?? 0) + 1;
    }
    points.push({ start: cursor.toISOString(), end: new Date(endMs).toISOString(), counts });
    cursor = next;
  }
  return { points, unit, topLogins };
}
