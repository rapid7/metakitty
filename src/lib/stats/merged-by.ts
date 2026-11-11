import type { HistoricalIssue } from "./types";
import { DAY_MS, HALF_YEAR_LOOKBACK_DAYS, MONTH_LOOKBACK_DAYS, YEAR_LOOKBACK_DAYS, getActorCounts, getActorWindows, type ActorCount, type ActorWindows } from "./actor-counts";

export { DAY_MS, HALF_YEAR_LOOKBACK_DAYS, MONTH_LOOKBACK_DAYS, YEAR_LOOKBACK_DAYS };

export const DEFAULT_EXCLUDED = ["msjenkins-r7"];

export type MergedByCount = ActorCount;
export type MergedByWindows = ActorWindows;

function mergedByEvents(issues: HistoricalIssue[]) {
  return issues
    .filter((issue) => issue.pullRequest && issue.mergedBy && issue.mergedAt)
    .map((issue) => ({ login: issue.mergedBy!, avatarUrl: issue.mergedByAvatarUrl, at: issue.mergedAt! }));
}

/** Counts merged PRs per merger login, optionally restricted to PRs merged on/after `sinceIso`, excluding the CI bot, sorted desc then alphabetically. */
export function getMergedByCounts(issues: HistoricalIssue[], sinceIso?: string, excluded: string[] = DEFAULT_EXCLUDED): MergedByCount[] {
  return getActorCounts(mergedByEvents(issues), sinceIso, excluded);
}

/** All-time/30-day/180-day/365-day merged-PR leaderboards, keyed by merger login. */
export function getMergedByWindows(issues: HistoricalIssue[], now: number = Date.now()): MergedByWindows {
  return getActorWindows(mergedByEvents(issues), now, DEFAULT_EXCLUDED);
}
