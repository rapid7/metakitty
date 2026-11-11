import { describe, expect, it } from "vitest";
import { getQuarterlySeries } from "../src/lib/stats/quarterly";
import { historicalIssue } from "./helpers";

describe("getQuarterlySeries", () => {
  it("walks 16 trailing quarters, clipping the current quarter's end to now", () => {
    const now = Date.parse("2026-02-15T00:00:00Z"); // mid Q1 2026
    const series = getQuarterlySeries([], () => true, now);
    expect(series).toHaveLength(16);
    expect(series[0].start).toBe("2022-04-01T00:00:00.000Z");
    expect(series[series.length - 1]).toMatchObject({ start: "2026-01-01T00:00:00.000Z", end: "2026-02-15T00:00:00.000Z" });
  });

  it("buckets opened/closed counts, split all vs rapid7, into the quarter they fall in", () => {
    const now = Date.parse("2026-04-01T00:00:00Z"); // start of Q2 2026
    const issues = [
      historicalIssue({ number: 1, reporter: "alice", createdAt: "2026-01-10T00:00:00Z", closedAt: "2026-01-20T00:00:00Z" }),
      historicalIssue({ number: 2, reporter: "bob-r7", createdAt: "2026-02-01T00:00:00Z", closedAt: null }),
      historicalIssue({ number: 3, reporter: "carol", createdAt: "2025-12-31T00:00:00Z", closedAt: "2026-01-05T00:00:00Z" }),
    ];
    const series = getQuarterlySeries(issues, () => true, now);
    const q1 = series.find((point) => point.start === "2026-01-01T00:00:00.000Z");
    expect(q1).toMatchObject({ opened: 2, closed: 2, rapid7Opened: 1, rapid7Closed: 0 });
  });

  it("only counts issues matching the category predicate", () => {
    const now = Date.parse("2026-04-01T00:00:00Z");
    const issues = [
      historicalIssue({ number: 1, pullRequest: true, createdAt: "2026-02-01T00:00:00Z" }),
      historicalIssue({ number: 2, pullRequest: false, createdAt: "2026-02-01T00:00:00Z" }),
    ];
    const series = getQuarterlySeries(issues, (issue) => issue.pullRequest, now);
    const q1 = series.find((point) => point.start === "2026-01-01T00:00:00.000Z");
    expect(q1).toMatchObject({ opened: 1 });
  });
});
