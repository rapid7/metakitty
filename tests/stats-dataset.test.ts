import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function fullIssueNode(overrides: Record<string, unknown> = {}) {
  return {
    project: "metasploit-framework",
    number: 1,
    title: "Example",
    url: "https://github.com/rapid7/metasploit-framework/issues/1",
    createdAt: "2026-01-01T00:00:00Z",
    closedAt: null,
    updatedAt: "2026-01-01T00:00:00Z",
    state: "OPEN",
    author: { login: "alice" },
    comments: { totalCount: 0 },
    assignees: { nodes: [] },
    labels: { nodes: [] },
    ...overrides,
  };
}

describe("loadHistoricalDataset's primary-repo safety net", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.FIXTURE_DATA;
    process.env.GITHUB_OAUTH_TOKEN = "test-token";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("../src/lib/stats/github-history-client");
    vi.doUnmock("../src/lib/stats/history-cache");
    vi.resetModules();
  });

  it("refuses to trust or cache a dataset with zero issues/PRs for the primary repo", async () => {
    vi.doMock("../src/lib/stats/github-history-client", () => ({
      fetchAllRepoHistories: vi.fn().mockResolvedValue({
        // Some other (non-primary) repo came back fine, but metasploit-framework didn't.
        issues: [fullIssueNode({ project: "rex" })],
        pullRequests: [],
        recentCommitAuthors: [],
      }),
    }));
    const writeHistoryCache = vi.fn();
    vi.doMock("../src/lib/stats/history-cache", () => ({
      readHistoryCache: vi.fn().mockReturnValue(null),
      writeHistoryCache,
    }));

    const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
    await expect(loadHistoricalDataset()).rejects.toThrow(/metasploit-framework/);
    expect(writeHistoryCache).not.toHaveBeenCalled();
  });

  it("succeeds and caches when the primary repo has data", async () => {
    vi.doMock("../src/lib/stats/github-history-client", () => ({
      fetchAllRepoHistories: vi.fn().mockResolvedValue({
        issues: [fullIssueNode()],
        pullRequests: [],
        recentCommitAuthors: [],
      }),
    }));
    const writeHistoryCache = vi.fn();
    vi.doMock("../src/lib/stats/history-cache", () => ({
      readHistoryCache: vi.fn().mockReturnValue(null),
      writeHistoryCache,
    }));

    const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
    const dataset = await loadHistoricalDataset();
    expect(dataset.issues).toHaveLength(1);
    expect(writeHistoryCache).toHaveBeenCalledTimes(1);
  });
});
