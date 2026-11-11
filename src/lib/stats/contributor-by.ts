import type { HistoricalIssue } from "./types";
import { DEFAULT_EXCLUDED } from "./merged-by";
import { getActorCounts, getActorWindows, type ActorCount, type ActorWindows } from "./actor-counts";

export type ContributorCount = ActorCount;
export type ContributorWindows = ActorWindows;

function contributorEvents(issues: HistoricalIssue[]) {
  return issues
    .filter((issue) => issue.pullRequest && issue.mergedBy && issue.mergedAt)
    .map((issue) => ({ login: issue.reporter, avatarUrl: issue.reporterAvatarUrl, at: issue.mergedAt! }));
}

/** Counts merged PRs per author login, optionally restricted to PRs merged on/after `sinceIso`, excluding the CI bot, sorted desc then alphabetically. */
export function getContributorCounts(issues: HistoricalIssue[], sinceIso?: string, excluded: string[] = DEFAULT_EXCLUDED): ContributorCount[] {
  return getActorCounts(contributorEvents(issues), sinceIso, excluded);
}

/** All-time/30-day/180-day/365-day merged-PR leaderboards, keyed by author login. */
export function getContributorWindows(issues: HistoricalIssue[], now: number = Date.now()): ContributorWindows {
  return getActorWindows(contributorEvents(issues), now, DEFAULT_EXCLUDED);
}
