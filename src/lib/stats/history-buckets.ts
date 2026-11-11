import type { HistoricalIssue } from "./types";

export interface RepoBuckets {
  /** Closed/merged items whose createdAt year has fully elapsed — never change again, keyed by that year. */
  frozen: Map<number, HistoricalIssue[]>;
  /** Everything else (open, any age; or created this year, any state) — still mutable, keyed by createdAt's year. */
  hot: Map<number, HistoricalIssue[]>;
}

function createdYear(issue: HistoricalIssue): number {
  return new Date(issue.createdAt).getUTCFullYear();
}

function pushTo(bucket: Map<number, HistoricalIssue[]>, year: number, issue: HistoricalIssue): void {
  const list = bucket.get(year);
  if (list) list.push(issue);
  else bucket.set(year, [issue]);
}

/**
 * Buckets one repo's issues/PRs by mutability: `frozen-<year>` for closed/merged items from a
 * fully-elapsed year (write-once — e.g. `map-historical-issue.ts` never un-closes a PR), `hot-<year>`
 * for everything still capable of changing — a still-open item from any year (including years
 * long past), or anything created this year regardless of state (not yet confirmed done for the
 * year). `now` is injectable for deterministic tests.
 */
export function bucketRepoHistory(issues: HistoricalIssue[], now: Date = new Date()): RepoBuckets {
  const currentYear = now.getUTCFullYear();
  const frozen = new Map<number, HistoricalIssue[]>();
  const hot = new Map<number, HistoricalIssue[]>();

  for (const issue of issues) {
    const year = createdYear(issue);
    const isFrozen = issue.state === "closed" && year < currentYear;
    pushTo(isFrozen ? frozen : hot, year, issue);
  }

  return { frozen, hot };
}
