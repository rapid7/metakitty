import type { HistoricalIssue } from "./types";
import { DEFAULT_EXCLUDED } from "./merged-by";
import { getActorTimeSeries, type ActorTimeSeries } from "./actor-trend";

export type ContributorTimeSeries = ActorTimeSeries;

/**
 * Merged PRs bucketed over time, from `sinceIso` (or the earliest merge in the data, if omitted)
 * through the current bucket, with the full per-login breakdown kept at every point. The contributor
 * mirror of `getMergedByTimeSeries` — same merged-PR scoping and bucketing, but keyed by PR author
 * (`reporter`) instead of merger (`mergedBy`).
 */
export function getContributorTimeSeries(issues: HistoricalIssue[], sinceIso?: string, now: number = Date.now()): ContributorTimeSeries {
  const events = issues
    .filter((issue) => issue.pullRequest && issue.mergedBy && issue.mergedAt)
    .map((issue) => ({ login: issue.reporter, avatarUrl: issue.reporterAvatarUrl, at: issue.mergedAt! }));
  return getActorTimeSeries(events, sinceIso, now, DEFAULT_EXCLUDED);
}
