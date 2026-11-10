import type { HistoricalIssue } from "./types";

export const DEFAULT_EXCLUDED = ["msjenkins-r7"];

export const DAY_MS = 86_400_000;
export const MONTH_LOOKBACK_DAYS = 30;
export const HALF_YEAR_LOOKBACK_DAYS = 180;
export const YEAR_LOOKBACK_DAYS = 365;

export interface MergedByCount {
  login: string;
  count: number;
  avatarUrl: string | null;
}

export interface MergedByWindows {
  all: MergedByCount[];
  days30: MergedByCount[];
  days180: MergedByCount[];
  days365: MergedByCount[];
}

/** Counts merged PRs per merger login, optionally restricted to PRs merged on/after `sinceIso`, excluding the CI bot, sorted desc then alphabetically. */
export function getMergedByCounts(issues: HistoricalIssue[], sinceIso?: string, excluded: string[] = DEFAULT_EXCLUDED): MergedByCount[] {
  const sinceMs = sinceIso ? Date.parse(sinceIso) : null;
  const counts = new Map<string, number>();
  const avatarUrls = new Map<string, string | null>();
  for (const issue of issues) {
    if (!issue.pullRequest || !issue.mergedBy || !issue.mergedAt) continue;
    if (excluded.includes(issue.mergedBy)) continue;
    if (sinceMs !== null && Date.parse(issue.mergedAt) < sinceMs) continue;
    counts.set(issue.mergedBy, (counts.get(issue.mergedBy) ?? 0) + 1);
    avatarUrls.set(issue.mergedBy, issue.mergedByAvatarUrl);
  }
  return [...counts.entries()]
    .map(([login, count]) => ({ login, count, avatarUrl: avatarUrls.get(login) ?? null }))
    .sort((a, b) => b.count - a.count || a.login.localeCompare(b.login));
}

/** All-time/30-day/180-day/365-day merged-PR leaderboards, keyed by merger login. */
export function getMergedByWindows(issues: HistoricalIssue[], now: number = Date.now()): MergedByWindows {
  const since = (days: number) => new Date(now - days * DAY_MS).toISOString();
  return {
    all: getMergedByCounts(issues),
    days30: getMergedByCounts(issues, since(MONTH_LOOKBACK_DAYS)),
    days180: getMergedByCounts(issues, since(HALF_YEAR_LOOKBACK_DAYS)),
    days365: getMergedByCounts(issues, since(YEAR_LOOKBACK_DAYS)),
  };
}
