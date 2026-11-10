import type { PullRequest } from "../src/lib/types";
import type { HistoricalIssue } from "../src/lib/stats/types";

export function historicalIssue(overrides: Partial<HistoricalIssue> = {}): HistoricalIssue {
  return {
    number: 1,
    project: "metasploit-framework",
    pullRequest: false,
    title: "Example",
    url: "https://github.com/rapid7/metasploit-framework/issues/1",
    reporter: "alice",
    reporterAvatarUrl: null,
    labels: [],
    state: "open",
    createdAt: "2026-10-14T12:00:00Z",
    closedAt: null,
    updatedAt: "2026-10-24T12:00:00Z",
    commentCount: 0,
    lastCommitAt: null,
    lastCommentAt: null,
    assignees: [],
    mergedBy: null,
    mergedAt: null,
    mergedByAvatarUrl: null,
    ...overrides,
  };
}

export function pr(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 1,
    title: "Example",
    author: "alice",
    authorAvatarUrl: null,
    status: "open",
    description: null,
    createdAt: "2026-10-14T12:00:00Z",
    updatedAt: "2026-10-24T12:00:00Z",
    commentCount: 0,
    totalChanges: 10,
    filesChanged: 1,
    modules: [],
    assignees: [],
    labels: [],
    reviewDecision: "none",
    ciStatus: "unknown",
    testingEnv: "unknown",
    testingEnvReason: "",
    githubUrl: "https://github.com/rapid7/metasploit-framework/pull/1",
    vulnRefs: [],
    ...overrides,
  };
}
