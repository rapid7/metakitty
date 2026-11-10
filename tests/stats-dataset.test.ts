import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STATS_REPOS } from "../src/lib/stats/repos";

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

function unmockAll(): void {
  vi.doUnmock("../src/lib/stats/github-history-client");
  vi.doUnmock("../src/lib/stats/history-store");
  vi.resetModules();
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
    unmockAll();
  });

  it("refuses to trust or persist a dataset with zero issues/PRs for the primary repo", async () => {
    vi.doMock("../src/lib/stats/github-history-client", () => ({
      fetchAllRepoHistories: vi.fn().mockResolvedValue({
        // Some other (non-primary) repo came back fine, but metasploit-framework didn't.
        issues: [fullIssueNode({ project: "rex" })],
        pullRequests: [],
        recentCommitAuthors: [],
      }),
    }));
    const writeHistoryStore = vi.fn();
    vi.doMock("../src/lib/stats/history-store", () => ({
      readFreshHistoryStore: vi.fn().mockReturnValue(null),
      readHistoryStore: vi.fn().mockReturnValue(null),
      writeHistoryStore,
    }));

    const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
    await expect(loadHistoricalDataset()).rejects.toThrow(/metasploit-framework/);
    expect(writeHistoryStore).not.toHaveBeenCalled();
  });

  it("succeeds and persists data/history/ when the primary repo has data", async () => {
    vi.doMock("../src/lib/stats/github-history-client", () => ({
      fetchAllRepoHistories: vi.fn().mockResolvedValue({
        issues: [fullIssueNode()],
        pullRequests: [],
        recentCommitAuthors: [],
      }),
    }));
    const writeHistoryStore = vi.fn();
    vi.doMock("../src/lib/stats/history-store", () => ({
      readFreshHistoryStore: vi.fn().mockReturnValue(null),
      readHistoryStore: vi.fn().mockReturnValue(null),
      writeHistoryStore,
    }));

    const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
    const dataset = await loadHistoricalDataset();
    expect(dataset.issues).toHaveLength(1);
    expect(writeHistoryStore).toHaveBeenCalledTimes(1);
    expect(writeHistoryStore).toHaveBeenCalledWith(expect.any(String), STATS_REPOS, dataset);
  });
});

describe("loadHistoricalDataset's data/history/ fallback", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.FIXTURE_DATA;
    delete process.env.GITHUB_OAUTH_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    unmockAll();
  });

  it("falls back to the lax read when the strict (fresh + repo-set-matching) read misses and there's no token", async () => {
    const fetchAllRepoHistories = vi.fn();
    vi.doMock("../src/lib/stats/github-history-client", () => ({ fetchAllRepoHistories }));
    const committedDataset = { issues: [fullIssueNode()], recentCommitAuthors: [], fetchedAt: "2026-01-01T00:00:00Z" };
    vi.doMock("../src/lib/stats/history-store", () => ({
      readFreshHistoryStore: vi.fn().mockReturnValue(null),
      readHistoryStore: vi.fn().mockReturnValue(committedDataset),
      writeHistoryStore: vi.fn(),
    }));

    const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
    const dataset = await loadHistoricalDataset();
    expect(dataset).toEqual(committedDataset);
    expect(fetchAllRepoHistories).not.toHaveBeenCalled();
  });

  it("prefers the strict (fresh + repo-set-matching) read over the lax fallback", async () => {
    const fetchAllRepoHistories = vi.fn();
    vi.doMock("../src/lib/stats/github-history-client", () => ({ fetchAllRepoHistories }));
    const freshDataset = { issues: [], recentCommitAuthors: [], fetchedAt: "2026-02-01T00:00:00Z" };
    const readHistoryStore = vi.fn();
    vi.doMock("../src/lib/stats/history-store", () => ({
      readFreshHistoryStore: vi.fn().mockReturnValue(freshDataset),
      readHistoryStore,
      writeHistoryStore: vi.fn(),
    }));

    const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
    const dataset = await loadHistoricalDataset();
    expect(dataset).toEqual(freshDataset);
    expect(readHistoryStore).not.toHaveBeenCalled();
    expect(fetchAllRepoHistories).not.toHaveBeenCalled();
  });

  it("throws when there's no token and both the strict and lax reads miss", async () => {
    vi.doMock("../src/lib/stats/github-history-client", () => ({ fetchAllRepoHistories: vi.fn() }));
    vi.doMock("../src/lib/stats/history-store", () => ({
      readFreshHistoryStore: vi.fn().mockReturnValue(null),
      readHistoryStore: vi.fn().mockReturnValue(null),
      writeHistoryStore: vi.fn(),
    }));

    const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
    await expect(loadHistoricalDataset()).rejects.toThrow(/GITHUB_OAUTH_TOKEN/);
  });
});
