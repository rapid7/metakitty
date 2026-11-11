import { describe, expect, it } from "vitest";
import { getMergedByTimeSeries } from "../src/lib/stats/merged-by-trend";
import { historicalIssue } from "./helpers";

describe("getMergedByTimeSeries", () => {
  const now = Date.parse("2026-11-10T12:00:00Z"); // Q4 2026

  it("buckets by quarter and keeps the top mergers as stable per-login keys, over the full (unbounded) history", () => {
    const issues = [
      historicalIssue({ number: 1, pullRequest: true, mergedBy: "alice", mergedAt: "2026-10-15T00:00:00Z" }), // Q4 2026
      historicalIssue({ number: 2, pullRequest: true, mergedBy: "alice", mergedAt: "2026-10-20T00:00:00Z" }), // Q4 2026
      historicalIssue({ number: 3, pullRequest: true, mergedBy: "bob", mergedAt: "2012-07-01T00:00:00Z" }), // far enough back to force quarter-grain
    ];
    const { points, topLogins, unit } = getMergedByTimeSeries(issues, undefined, now);
    expect(unit).toBe("quarter");
    expect(topLogins).toEqual(["alice", "bob"]);
    expect(points[0].start).toBe(new Date(Date.UTC(2012, 6, 1)).toISOString());
    expect(points[points.length - 1].counts).toEqual({ alice: 2 });
  });

  it("falls back to a single (empty) bucket when there are no merged PRs at all", () => {
    const { points } = getMergedByTimeSeries([historicalIssue({ pullRequest: true, mergedBy: null, mergedAt: null })], undefined, now);
    expect(points.length).toBe(1);
    expect(points[0].counts).toEqual({});
  });

  it("keeps every merger's own count — including past the top 5 — and excludes the CI bot, while topLogins is just the top 5", () => {
    const issues = [
      ...["a", "b", "c", "d", "e"].map((login, index) =>
        historicalIssue({ number: index, pullRequest: true, mergedBy: login, mergedAt: "2012-10-01T00:00:00Z" })
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        historicalIssue({ number: 100 + index, pullRequest: true, mergedBy: "f", mergedAt: "2012-10-02T00:00:00Z" })
      ),
      historicalIssue({ number: 200, pullRequest: true, mergedBy: "msjenkins-r7", mergedAt: "2012-10-01T00:00:00Z" }),
    ];
    const { points, topLogins } = getMergedByTimeSeries(issues, undefined, now);
    expect(topLogins).toEqual(["f", "a", "b", "c", "d"]);

    const bucket = points[0];
    expect(bucket.counts).toEqual({ f: 6, a: 1, b: 1, c: 1, d: 1, e: 1 });
  });

  describe("windowed by sinceIso (matching getMergedByCounts/getMergedByWindows)", () => {
    it("uses day buckets, scopes topLogins to the window, and excludes merges before the exact cutoff", () => {
      const sinceIso = new Date(now - 30 * 86_400_000).toISOString();
      const issues = [
        historicalIssue({ number: 1, pullRequest: true, mergedBy: "recent", mergedAt: new Date(now - 1 * 86_400_000).toISOString() }),
        historicalIssue({ number: 2, pullRequest: true, mergedBy: "old", mergedAt: new Date(now - 31 * 86_400_000).toISOString() }), // just outside the 30-day window
      ];
      const { points, topLogins, unit } = getMergedByTimeSeries(issues, sinceIso, now);
      expect(unit).toBe("day");
      expect(topLogins).toEqual(["recent"]); // "old" is outside the window, so it's not a candidate top merger here
      const totalRecent = points.reduce((sum, point) => sum + (point.counts.recent ?? 0), 0);
      const totalOld = points.reduce((sum, point) => sum + (point.counts.old ?? 0), 0);
      expect(totalRecent).toBe(1);
      expect(totalOld).toBe(0);
    });

    it("picks week buckets for a ~180 day window and month buckets for a ~365 day window", () => {
      const weekUnit = getMergedByTimeSeries([], new Date(now - 180 * 86_400_000).toISOString(), now).unit;
      const monthUnit = getMergedByTimeSeries([], new Date(now - 365 * 86_400_000).toISOString(), now).unit;
      expect(weekUnit).toBe("week");
      expect(monthUnit).toBe("month");
    });
  });
});
