import { describe, expect, it } from "vitest";
import { getPrReviewStatus, getRepoSummaries } from "../src/lib/stats/repo-summary";
import { historicalIssue } from "./helpers";

describe("getPrReviewStatus", () => {
  it("is needs_review when GitHub says a review is required", () => {
    expect(getPrReviewStatus(historicalIssue({ reviewDecision: "review_required" }))).toBe("needs_review");
  });

  it("is needs_review when GitHub has no decision at all (no reviewers requested/submitted)", () => {
    expect(getPrReviewStatus(historicalIssue({ reviewDecision: "none" }))).toBe("needs_review");
  });

  it("is changes_requested when a reviewer asked for changes", () => {
    expect(getPrReviewStatus(historicalIssue({ reviewDecision: "changes_requested" }))).toBe("changes_requested");
  });

  it("is approved when a reviewer approved it", () => {
    expect(getPrReviewStatus(historicalIssue({ reviewDecision: "approved" }))).toBe("approved");
  });

  it("is null for a closed/merged PR (reviewDecision is only populated while open)", () => {
    expect(getPrReviewStatus(historicalIssue({ reviewDecision: null }))).toBe(null);
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

  it("carries each open PR's review status through into its summary", () => {
    const summaries = getRepoSummaries([
      historicalIssue({ number: 1, pullRequest: true, state: "open", reviewDecision: "changes_requested" }),
    ]);
    expect(summaries[0].openPrs[0]).toMatchObject({ reviewStatus: "changes_requested" });
  });
});
