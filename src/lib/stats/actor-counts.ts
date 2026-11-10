export const DAY_MS = 86_400_000;
export const MONTH_LOOKBACK_DAYS = 30;
export const HALF_YEAR_LOOKBACK_DAYS = 180;
export const YEAR_LOOKBACK_DAYS = 365;

/** A single dated, attributable event — e.g. a PR merge, keyed by either who merged it or who authored it. */
export interface ActorEvent {
  login: string;
  avatarUrl: string | null;
  at: string;
}

export interface ActorCount {
  login: string;
  count: number;
  avatarUrl: string | null;
}

export interface ActorWindows {
  all: ActorCount[];
  days30: ActorCount[];
  days180: ActorCount[];
  days365: ActorCount[];
}

/** Counts events per login, optionally restricted to events on/after `sinceIso`, excluding `excluded` logins, sorted desc then alphabetically. */
export function getActorCounts(events: ActorEvent[], sinceIso?: string, excluded: string[] = []): ActorCount[] {
  const sinceMs = sinceIso ? Date.parse(sinceIso) : null;
  const counts = new Map<string, number>();
  const avatarUrls = new Map<string, string | null>();
  for (const event of events) {
    if (excluded.includes(event.login)) continue;
    if (sinceMs !== null && Date.parse(event.at) < sinceMs) continue;
    counts.set(event.login, (counts.get(event.login) ?? 0) + 1);
    avatarUrls.set(event.login, event.avatarUrl);
  }
  return [...counts.entries()]
    .map(([login, count]) => ({ login, count, avatarUrl: avatarUrls.get(login) ?? null }))
    .sort((a, b) => b.count - a.count || a.login.localeCompare(b.login));
}

/** All-time/30-day/180-day/365-day leaderboards, keyed by login. */
export function getActorWindows(events: ActorEvent[], now: number = Date.now(), excluded: string[] = []): ActorWindows {
  const since = (days: number) => new Date(now - days * DAY_MS).toISOString();
  return {
    all: getActorCounts(events, undefined, excluded),
    days30: getActorCounts(events, since(MONTH_LOOKBACK_DAYS), excluded),
    days180: getActorCounts(events, since(HALF_YEAR_LOOKBACK_DAYS), excluded),
    days365: getActorCounts(events, since(YEAR_LOOKBACK_DAYS), excluded),
  };
}
