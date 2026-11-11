import { describe, expect, it } from "vitest";
import { getRepoSummaries, hasReview } from "../src/lib/stats/repo-summary";
import { historicalIssue } from "./helpers";

describe("hasReview", () => {
  it("is false when there are no comments", () => {
    expect(hasReview(historicalIssue({ commentCount: 0 }))).toBe(false);
  });

  it("is true when the last comment is at-or-after the last commit", () => {
    const issue = historicalIssue({ commentCount: 1, lastCommitAt: "2026-01-01T00:00:00Z", lastCommentAt: "2026-01-02T00:00:00Z" });
    expect(hasReview(issue)).toBe(true);
  });

  it("is false when there are unreviewed commits after the last comment", () => {
    const issue = historicalIssue({ commentCount: 1, lastCommitAt: "2026-01-02T00:00:00Z", lastCommentAt: "2026-01-01T00:00:00Z" });
    expect(hasReview(issue)).toBe(false);
  });

  it("defaults to true when timing data is missing but there are comments", () => {
    expect(hasReview(historicalIssue({ commentCount: 2, lastCommitAt: null, lastCommentAt: null }))).toBe(true);
  });
});

describe("getRepoSummaries", () => {
  it("groups PRs by repo, splits open/closed, sorted by open PR count desc", () => {
    const summaries = getRepoSummaries([
      historicalIssue({ number: 1, project: "metasploit-framework", pullRequest: true, state: "open" }),
      historicalIssue({ number: 2, project: "metasploit-framework", pullRequest: true, state: "closed", closedAt: "2026-01-01T00:00:00Z" }),
      historicalIssue({ number: 3, project: "rex", pullRequest: true, state: "open" }),
      historicalIssue({ number: 4, project: "metasploit-framework", pullRequest: false }),
    ]);
    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({ repo: "metasploit-framework", totalCount: 2 });
    expect(summaries[0].openPrs).toHaveLength(1);
    expect(summaries[0].closedPrs).toHaveLength(1);
    expect(summaries[1]).toMatchObject({ repo: "rex", totalCount: 1 });
  });

  it("ranks a repo with fewer total PRs but an open one above a repo with more total PRs but none open", () => {
    const summaries = getRepoSummaries([
      historicalIssue({ number: 1, project: "quiet-but-active", pullRequest: true, state: "open" }),
      ...Array.from({ length: 5 }, (_, i) =>
        historicalIssue({ number: 100 + i, project: "noisy-but-stale", pullRequest: true, state: "closed", closedAt: "2026-01-01T00:00:00Z" })
      ),
    ]);
    expect(summaries.map((s) => s.repo)).toEqual(["quiet-but-active", "noisy-but-stale"]);
  });

  it("ignores non-PR issues entirely", () => {
    expect(getRepoSummaries([historicalIssue({ pullRequest: false })])).toEqual([]);
  });
});
