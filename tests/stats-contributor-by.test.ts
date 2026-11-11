import { describe, expect, it } from "vitest";
import { getContributorCounts, getContributorWindows } from "../src/lib/stats/contributor-by";
import { historicalIssue } from "./helpers";

describe("getContributorCounts", () => {
  it("counts merged PRs per author login, sorted by count desc then login asc", () => {
    const counts = getContributorCounts([
      historicalIssue({ number: 1, pullRequest: true, reporter: "alice", mergedBy: "maintainer", mergedAt: "2026-10-01T00:00:00Z" }),
      historicalIssue({ number: 2, pullRequest: true, reporter: "bob", mergedBy: "maintainer", mergedAt: "2026-10-02T00:00:00Z" }),
      historicalIssue({ number: 3, pullRequest: true, reporter: "alice", mergedBy: "maintainer", mergedAt: "2026-10-03T00:00:00Z" }),
      historicalIssue({ number: 4, pullRequest: true, reporter: "carol", mergedBy: "maintainer", mergedAt: "2026-10-04T00:00:00Z" }),
    ]);
    expect(counts).toEqual([
      { login: "alice", count: 2, avatarUrl: null },
      { login: "bob", count: 1, avatarUrl: null },
      { login: "carol", count: 1, avatarUrl: null },
    ]);
  });

  it("carries through the author's avatar URL", () => {
    const counts = getContributorCounts([
      historicalIssue({ number: 1, pullRequest: true, reporter: "alice", reporterAvatarUrl: "https://avatars.example/alice", mergedBy: "maintainer", mergedAt: "2026-10-01T00:00:00Z" }),
    ]);
    expect(counts).toEqual([{ login: "alice", count: 1, avatarUrl: "https://avatars.example/alice" }]);
  });

  it("ignores issues, non-merged PRs, and closed-but-not-merged PRs", () => {
    const counts = getContributorCounts([
      historicalIssue({ number: 1, pullRequest: false, reporter: "alice", mergedBy: "maintainer", mergedAt: "2026-10-01T00:00:00Z" }),
      historicalIssue({ number: 2, pullRequest: true, reporter: "alice", mergedBy: null, mergedAt: null }),
      historicalIssue({ number: 3, pullRequest: true, reporter: "alice", state: "closed", closedAt: "2026-10-01T00:00:00Z", mergedBy: null, mergedAt: null }),
    ]);
    expect(counts).toEqual([]);
  });

  it("excludes the CI bot by default", () => {
    const counts = getContributorCounts([historicalIssue({ number: 1, pullRequest: true, reporter: "msjenkins-r7", mergedBy: "maintainer", mergedAt: "2026-10-01T00:00:00Z" })]);
    expect(counts).toEqual([]);
  });

  it("restricts to PRs merged on/after sinceIso when given", () => {
    const issues = [
      historicalIssue({ number: 1, pullRequest: true, reporter: "alice", mergedBy: "maintainer", mergedAt: "2026-09-01T00:00:00Z" }),
      historicalIssue({ number: 2, pullRequest: true, reporter: "bob", mergedBy: "maintainer", mergedAt: "2026-10-15T00:00:00Z" }),
    ];
    expect(getContributorCounts(issues, "2026-10-01T00:00:00Z")).toEqual([{ login: "bob", count: 1, avatarUrl: null }]);
  });
});

describe("getContributorWindows", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");

  it("buckets merged PRs into all/30/180/365-day windows by mergedAt", () => {
    const issues = [
      historicalIssue({ number: 1, pullRequest: true, reporter: "recent", mergedBy: "maintainer", mergedAt: "2026-11-05T00:00:00Z" }), // within 30d
      historicalIssue({ number: 2, pullRequest: true, reporter: "midyear", mergedBy: "maintainer", mergedAt: "2026-08-01T00:00:00Z" }), // ~100d: within 180d, not 30d
      historicalIssue({ number: 3, pullRequest: true, reporter: "oldyear", mergedBy: "maintainer", mergedAt: "2026-02-01T00:00:00Z" }), // ~280d: within 365d, not 180d
      historicalIssue({ number: 4, pullRequest: true, reporter: "ancient", mergedBy: "maintainer", mergedAt: "2020-01-01T00:00:00Z" }), // only in "all"
    ];
    const windows = getContributorWindows(issues, now);
    expect(windows.days30.map((c) => c.login)).toEqual(["recent"]);
    expect(windows.days180.map((c) => c.login).sort()).toEqual(["midyear", "recent"]);
    expect(windows.days365.map((c) => c.login).sort()).toEqual(["midyear", "oldyear", "recent"]);
    expect(windows.all.map((c) => c.login).sort()).toEqual(["ancient", "midyear", "oldyear", "recent"]);
  });
});
