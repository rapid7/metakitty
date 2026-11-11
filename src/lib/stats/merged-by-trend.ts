import type { HistoricalIssue } from "./types";
import { DEFAULT_EXCLUDED } from "./merged-by";
import { OTHER_KEY, getActorTimeSeries, type ActorTimePoint, type ActorTimeSeries, type ActorTimeUnit } from "./actor-trend";

export { OTHER_KEY };

export type MergedByTimeUnit = ActorTimeUnit;
export type MergedByTimePoint = ActorTimePoint;
export type MergedByTimeSeries = ActorTimeSeries;

/**
 * Merged PRs bucketed over time, from `sinceIso` (or the earliest merge in the data, if omitted)
 * through the current bucket, with the full per-login breakdown kept at every point — the trend-view
 * analog of the queue dashboard's per-assignee creation histogram, bucketed by merge date instead of
 * creation date. Scoped the same way as `getMergedByCounts`/`getMergedByWindows`, so a window's trend
 * chart and its ranking table agree on what counts as "within this window".
 */
export function getMergedByTimeSeries(issues: HistoricalIssue[], sinceIso?: string, now: number = Date.now()): MergedByTimeSeries {
  const events = issues
    .filter((issue) => issue.pullRequest && issue.mergedBy && issue.mergedAt)
    .map((issue) => ({ login: issue.mergedBy!, avatarUrl: issue.mergedByAvatarUrl, at: issue.mergedAt! }));
  return getActorTimeSeries(events, sinceIso, now, DEFAULT_EXCLUDED);
}
