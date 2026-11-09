import type { PullRequest } from "../src/lib/types";

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
