import { DAY_MS, getActorCounts, type ActorEvent } from "./actor-counts";

const TOP_N = 5; // matches the 5 categorical chart color slots (--chart-1..5); the rest render folded into "other"
export const OTHER_KEY = "other";

export type ActorTimeUnit = "day" | "week" | "month" | "quarter";

function bucketStart(unit: ActorTimeUnit, date: Date): Date {
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

function advance(unit: ActorTimeUnit, date: Date): Date {
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
function pickUnit(spanMs: number): ActorTimeUnit {
  const spanDays = spanMs / DAY_MS;
  if (spanDays <= 45) return "day";
  if (spanDays <= 210) return "week";
  if (spanDays <= 800) return "month";
  return "quarter";
}

export interface ActorTimePoint {
  start: string;
  end: string;
  /** Every login's raw count for this bucket, keyed by their actual login — not pre-folded into "other". Callers (the chart) decide how to group/display this, e.g. top-5 + other for the default view, or a specific non-top-5 login split out on hover. */
  counts: Record<string, number>;
}

export interface ActorTimeSeries {
  points: ActorTimePoint[];
  unit: ActorTimeUnit;
  /** The top logins within this series' own window (all-time top 5 when `sinceIso` is omitted), fixed across every point so a login's color/series identity never shifts between buckets. */
  topLogins: string[];
}

/**
 * Events bucketed over time, from `sinceIso` (or the earliest event in the data, if omitted)
 * through the current bucket, with the full per-login breakdown kept at every point — the trend-view
 * analog of the queue dashboard's per-assignee creation histogram. Scoped the same way as
 * `getActorCounts`/`getActorWindows`, so a window's trend chart and its ranking table agree on what
 * counts as "within this window".
 */
export function getActorTimeSeries(events: ActorEvent[], sinceIso?: string, now: number = Date.now(), excluded: string[] = []): ActorTimeSeries {
  const topLogins = getActorCounts(events, sinceIso, excluded)
    .slice(0, TOP_N)
    .map((c) => c.login);

  const sinceMs = sinceIso ? Date.parse(sinceIso) : null;
  const eventMsValues = events
    .filter((event) => !excluded.includes(event.login))
    .map((event) => Date.parse(event.at))
    .filter((ms) => sinceMs === null || ms >= sinceMs);

  const rangeStartMs = sinceMs ?? (eventMsValues.length ? Math.min(...eventMsValues) : now);
  const unit = pickUnit(now - rangeStartMs);

  const points: ActorTimePoint[] = [];
  let cursor = bucketStart(unit, new Date(rangeStartMs));

  while (cursor.getTime() < now) {
    const next = advance(unit, cursor);
    const startMs = cursor.getTime();
    const endMs = Math.min(next.getTime(), now);

    const counts: Record<string, number> = {};
    for (const event of events) {
      if (excluded.includes(event.login)) continue;
      const atMs = Date.parse(event.at);
      if (atMs < startMs || atMs >= endMs) continue;
      if (sinceMs !== null && atMs < sinceMs) continue;
      counts[event.login] = (counts[event.login] ?? 0) + 1;
    }
    points.push({ start: cursor.toISOString(), end: new Date(endMs).toISOString(), counts });
    cursor = next;
  }
  return { points, unit, topLogins };
}
