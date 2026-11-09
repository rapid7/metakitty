import { describe, expect, it } from "vitest";
import { getRecentlyMergedPrs } from "../src/lib/stats/commits-merged";
import { historicalIssue } from "./helpers";

describe("getRecentlyMergedPrs", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");

  it("includes only PRs closed in the last 30 days, most recent first, capped at the limit", () => {
    const prs = getRecentlyMergedPrs(
      [
        historicalIssue({ number: 1, pullRequest: true, closedAt: "2026-08-01T00:00:00Z" }), // too old
        historicalIssue({ number: 2, pullRequest: true, closedAt: "2026-10-20T00:00:00Z" }),
        historicalIssue({ number: 3, pullRequest: true, closedAt: "2026-10-23T00:00:00Z" }),
        historicalIssue({ number: 4, pullRequest: false, closedAt: "2026-10-23T00:00:00Z" }), // not a PR
        historicalIssue({ number: 5, pullRequest: true, closedAt: null }), // not closed
      ],
      6,
      now
    );
    expect(prs.map((pr) => pr.number)).toEqual([3, 2]);
  });

  it("respects the limit", () => {
    const issues = Array.from({ length: 10 }, (_, index) =>
      historicalIssue({ number: index, pullRequest: true, closedAt: "2026-10-23T00:00:00Z" })
    );
    expect(getRecentlyMergedPrs(issues, 3, now)).toHaveLength(3);
  });
});
