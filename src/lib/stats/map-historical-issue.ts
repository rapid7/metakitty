import type { TaggedIssueNode, TaggedPullRequestNode } from "./github-history-client";
import { mapReviewDecision } from "../review-decision";
import type { HistoricalIssue, IssueState } from "./types";

function mapState(state: "OPEN" | "CLOSED" | "MERGED"): IssueState {
  return state === "OPEN" ? "open" : "closed";
}

export function mapHistoricalIssue(raw: TaggedIssueNode): HistoricalIssue {
  return {
    number: raw.number,
    project: raw.project,
    pullRequest: false,
    title: raw.title,
    url: raw.url,
    reporter: raw.author?.login ?? "ghost",
    reporterAvatarUrl: raw.author?.avatarUrl ?? null,
    labels: (raw.labels?.nodes ?? []).map((label) => label.name),
    state: mapState(raw.state),
    createdAt: raw.createdAt,
    closedAt: raw.closedAt,
    updatedAt: raw.updatedAt,
    commentCount: raw.comments.totalCount,
    lastCommitAt: null,
    lastCommentAt: null,
    assignees: raw.assignees.nodes.map((assignee) => assignee.login),
    mergedBy: null,
    mergedAt: null,
    mergedByAvatarUrl: null,
    reviewDecision: null,
  };
}

/** `lastCommitAt`/`lastCommentAt`/`reviewDecision` are only meaningful (and only populated) for currently-open PRs — closed PRs never need them. */
export function mapHistoricalPullRequest(raw: TaggedPullRequestNode): HistoricalIssue {
  const state = mapState(raw.state);
  const isOpen = state === "open";
  return {
    number: raw.number,
    project: raw.project,
    pullRequest: true,
    title: raw.title,
    url: raw.url,
    reporter: raw.author?.login ?? "ghost",
    reporterAvatarUrl: raw.author?.avatarUrl ?? null,
    labels: (raw.labels?.nodes ?? []).map((label) => label.name),
    state,
    createdAt: raw.createdAt,
    closedAt: raw.closedAt,
    updatedAt: raw.updatedAt,
    commentCount: raw.comments.totalCount,
    lastCommitAt: isOpen ? raw.commits.nodes[0]?.commit.committedDate ?? null : null,
    lastCommentAt: isOpen ? raw.comments.nodes[0]?.createdAt ?? null : null,
    assignees: raw.assignees.nodes.map((assignee) => assignee.login),
    mergedBy: raw.mergedBy?.login ?? null,
    mergedAt: raw.mergedAt ?? null,
    mergedByAvatarUrl: raw.mergedBy?.avatarUrl ?? null,
    reviewDecision: isOpen ? mapReviewDecision(raw.reviewDecision) : null,
  };
}
