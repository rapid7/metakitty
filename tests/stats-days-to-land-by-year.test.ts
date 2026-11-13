import { describe, expect, it } from "vitest";
import { getDaysToLandByYear } from "../src/lib/stats/days-to-land-by-year";
import { historicalIssue } from "./helpers";

describe("getDaysToLandByYear", () => {
  it("averages days from creation to merge per calendar year merged, sorted chronologically", () => {
    const years = getDaysToLandByYear([
      historicalIssue({ number: 1, pullRequest: true, mergedBy: "alice", createdAt: "2025-10-01T00:00:00Z", mergedAt: "2025-10-03T00:00:00Z" }), // 2 days, 2025
      historicalIssue({ number: 2, pullRequest: true, mergedBy: "bob", createdAt: "2025-10-01T00:00:00Z", mergedAt: "2025-10-05T00:00:00Z" }), // 4 days, 2025
      historicalIssue({ number: 3, pullRequest: true, mergedBy: "carol", createdAt: "2026-10-01T00:00:00Z", mergedAt: "2026-10-02T00:00:00Z" }), // 1 day, 2026
    ]);
    expect(years).toEqual([
      { year: 2025, count: 2, averageDays: 3 },
      { year: 2026, count: 1, averageDays: 1 },
    ]);
  });

  it("ignores issues, non-merged PRs, and closed-but-not-merged PRs", () => {
    const years = getDaysToLandByYear([
      historicalIssue({ number: 1, pullRequest: false, mergedBy: "alice", mergedAt: "2026-10-01T00:00:00Z" }),
      historicalIssue({ number: 2, pullRequest: true, mergedBy: null, mergedAt: null }),
      historicalIssue({ number: 3, pullRequest: true, state: "closed", closedAt: "2026-10-01T00:00:00Z", mergedBy: null, mergedAt: null }),
    ]);
    expect(years).toEqual([]);
  });

  it("excludes the CI bot by default", () => {
    const years = getDaysToLandByYear([
      historicalIssue({ number: 1, pullRequest: true, mergedBy: "msjenkins-r7", createdAt: "2026-10-01T00:00:00Z", mergedAt: "2026-10-02T00:00:00Z" }),
    ]);
    expect(years).toEqual([]);
  });

  it("buckets by the year the PR was merged in, not the year it was created", () => {
    const years = getDaysToLandByYear([
      historicalIssue({ number: 1, pullRequest: true, mergedBy: "alice", createdAt: "2025-12-20T00:00:00Z", mergedAt: "2026-01-05T00:00:00Z" }), // 16 days
    ]);
    expect(years).toEqual([{ year: 2026, count: 1, averageDays: 16 }]);
  });
});
