import { describe, expect, it } from "vitest";
import { mapHistoricalIssue, mapHistoricalPullRequest } from "../src/lib/stats/map-historical-issue";
import type { TaggedIssueNode, TaggedPullRequestNode } from "../src/lib/stats/github-history-client";

function issueNode(overrides: Partial<TaggedIssueNode> = {}): TaggedIssueNode {
  return {
    project: "metasploit-framework",
    number: 1,
    title: "Example issue",
    url: "https://github.com/rapid7/metasploit-framework/issues/1",
    createdAt: "2026-01-01T00:00:00Z",
    closedAt: null,
    updatedAt: "2026-01-02T00:00:00Z",
    state: "OPEN",
    author: { login: "alice", avatarUrl: "https://avatars.example/alice" },
    comments: { totalCount: 2 },
    assignees: { nodes: [] },
    labels: { nodes: [{ name: "bug" }] },
    ...overrides,
  };
}

function prNode(overrides: Partial<TaggedPullRequestNode> = {}): TaggedPullRequestNode {
  return {
    ...issueNode(),
    state: "OPEN",
    comments: { totalCount: 2, nodes: [{ createdAt: "2026-01-03T00:00:00Z" }] },
    commits: { nodes: [{ commit: { committedDate: "2026-01-02T12:00:00Z" } }] },
    mergedBy: null,
    mergedAt: null,
    reviewDecision: "REVIEW_REQUIRED",
    ...overrides,
  };
}

describe("mapHistoricalIssue", () => {
  it("maps fields and defaults a missing author to ghost", () => {
    expect(mapHistoricalIssue(issueNode({ author: null }))).toMatchObject({
      number: 1,
      project: "metasploit-framework",
      pullRequest: false,
      reporter: "ghost",
      reporterAvatarUrl: null,
      labels: ["bug"],
      state: "open",
      lastCommitAt: null,
      lastCommentAt: null,
      reviewDecision: null,
    });
  });

  it("maps the reporter's avatar URL when present", () => {
    expect(mapHistoricalIssue(issueNode())).toMatchObject({ reporter: "alice", reporterAvatarUrl: "https://avatars.example/alice" });
  });

  it("treats a null labels connection as no labels", () => {
    expect(mapHistoricalIssue(issueNode({ labels: null }))).toMatchObject({ labels: [] });
  });

  it("maps CLOSED state", () => {
    expect(mapHistoricalIssue(issueNode({ state: "CLOSED", closedAt: "2026-02-01T00:00:00Z" }))).toMatchObject({ state: "closed", closedAt: "2026-02-01T00:00:00Z" });
  });
});

describe("mapHistoricalPullRequest", () => {
  it("populates lastCommitAt/lastCommentAt for an open PR", () => {
    const mapped = mapHistoricalPullRequest(prNode());
    expect(mapped).toMatchObject({
      pullRequest: true,
      state: "open",
      lastCommitAt: "2026-01-02T12:00:00Z",
      lastCommentAt: "2026-01-03T00:00:00Z",
    });
  });

  it("maps MERGED to closed and never populates lastCommitAt/lastCommentAt for a closed PR", () => {
    const mapped = mapHistoricalPullRequest(prNode({ state: "MERGED", closedAt: "2026-03-01T00:00:00Z" }));
    expect(mapped).toMatchObject({ state: "closed", closedAt: "2026-03-01T00:00:00Z", lastCommitAt: null, lastCommentAt: null });
  });

  it("maps mergedBy/mergedAt/mergedByAvatarUrl when present, and defaults to null when absent", () => {
    const merged = mapHistoricalPullRequest(
      prNode({
        state: "MERGED",
        closedAt: "2026-03-01T00:00:00Z",
        mergedBy: { login: "alice", avatarUrl: "https://avatars.example/alice" },
        mergedAt: "2026-03-01T00:00:00Z",
      })
    );
    expect(merged).toMatchObject({ mergedBy: "alice", mergedAt: "2026-03-01T00:00:00Z", mergedByAvatarUrl: "https://avatars.example/alice" });

    const open = mapHistoricalPullRequest(prNode());
    expect(open).toMatchObject({ mergedBy: null, mergedAt: null, mergedByAvatarUrl: null });
  });

  it("maps reviewDecision for an open PR, lowercased", () => {
    expect(mapHistoricalPullRequest(prNode({ reviewDecision: "APPROVED" }))).toMatchObject({ reviewDecision: "approved" });
    expect(mapHistoricalPullRequest(prNode({ reviewDecision: "CHANGES_REQUESTED" }))).toMatchObject({ reviewDecision: "changes_requested" });
    expect(mapHistoricalPullRequest(prNode({ reviewDecision: null }))).toMatchObject({ reviewDecision: "none" });
  });

  it("never populates reviewDecision for a closed PR", () => {
    const closed = mapHistoricalPullRequest(prNode({ state: "MERGED", closedAt: "2026-03-01T00:00:00Z", reviewDecision: "APPROVED" }));
    expect(closed).toMatchObject({ reviewDecision: null });
  });
});
