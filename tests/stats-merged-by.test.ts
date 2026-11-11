import { describe, expect, it } from "vitest";
import { getMergedByCounts, getMergedByWindows } from "../src/lib/stats/merged-by";
import { historicalIssue } from "./helpers";

describe("getMergedByCounts", () => {
  it("counts merged PRs per merger login, sorted by count desc then login asc", () => {
    const counts = getMergedByCounts([
      historicalIssue({ number: 1, pullRequest: true, mergedBy: "alice", mergedAt: "2026-10-01T00:00:00Z" }),
      historicalIssue({ number: 2, pullRequest: true, mergedBy: "bob", mergedAt: "2026-10-02T00:00:00Z" }),
      historicalIssue({ number: 3, pullRequest: true, mergedBy: "alice", mergedAt: "2026-10-03T00:00:00Z" }),
      historicalIssue({ number: 4, pullRequest: true, mergedBy: "carol", mergedAt: "2026-10-04T00:00:00Z" }),
    ]);
    expect(counts).toEqual([
      { login: "alice", count: 2, avatarUrl: null },
      { login: "bob", count: 1, avatarUrl: null },
      { login: "carol", count: 1, avatarUrl: null },
    ]);
  });

  it("carries through the merger's avatar URL", () => {
    const counts = getMergedByCounts([
      historicalIssue({ number: 1, pullRequest: true, mergedBy: "alice", mergedAt: "2026-10-01T00:00:00Z", mergedByAvatarUrl: "https://avatars.example/alice" }),
    ]);
    expect(counts).toEqual([{ login: "alice", count: 1, avatarUrl: "https://avatars.example/alice" }]);
  });

  it("ignores issues, non-merged PRs, and closed-but-not-merged PRs", () => {
    const counts = getMergedByCounts([
      historicalIssue({ number: 1, pullRequest: false, mergedBy: "alice", mergedAt: "2026-10-01T00:00:00Z" }),
      historicalIssue({ number: 2, pullRequest: true, mergedBy: null, mergedAt: null }),
      historicalIssue({ number: 3, pullRequest: true, state: "closed", closedAt: "2026-10-01T00:00:00Z", mergedBy: null, mergedAt: null }),
    ]);
    expect(counts).toEqual([]);
  });

  it("excludes the CI bot by default", () => {
    const counts = getMergedByCounts([historicalIssue({ number: 1, pullRequest: true, mergedBy: "msjenkins-r7", mergedAt: "2026-10-01T00:00:00Z" })]);
    expect(counts).toEqual([]);
  });

  it("restricts to PRs merged on/after sinceIso when given", () => {
    const issues = [
      historicalIssue({ number: 1, pullRequest: true, mergedBy: "alice", mergedAt: "2026-09-01T00:00:00Z" }),
      historicalIssue({ number: 2, pullRequest: true, mergedBy: "bob", mergedAt: "2026-10-15T00:00:00Z" }),
    ];
    expect(getMergedByCounts(issues, "2026-10-01T00:00:00Z")).toEqual([{ login: "bob", count: 1, avatarUrl: null }]);
  });
});

describe("getMergedByWindows", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");

  it("buckets merged PRs into all/30/180/365-day windows by mergedAt", () => {
    const issues = [
      historicalIssue({ number: 1, pullRequest: true, mergedBy: "recent", mergedAt: "2026-11-05T00:00:00Z" }), // within 30d
      historicalIssue({ number: 2, pullRequest: true, mergedBy: "midyear", mergedAt: "2026-08-01T00:00:00Z" }), // ~100d: within 180d, not 30d
      historicalIssue({ number: 3, pullRequest: true, mergedBy: "oldyear", mergedAt: "2026-02-01T00:00:00Z" }), // ~280d: within 365d, not 180d
      historicalIssue({ number: 4, pullRequest: true, mergedBy: "ancient", mergedAt: "2020-01-01T00:00:00Z" }), // only in "all"
    ];
    const windows = getMergedByWindows(issues, now);
    expect(windows.days30.map((c) => c.login)).toEqual(["recent"]);
    expect(windows.days180.map((c) => c.login).sort()).toEqual(["midyear", "recent"]);
    expect(windows.days365.map((c) => c.login).sort()).toEqual(["midyear", "oldyear", "recent"]);
    expect(windows.all.map((c) => c.login).sort()).toEqual(["ancient", "midyear", "oldyear", "recent"]);
  });
});
