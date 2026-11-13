import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STATS_REPOS } from "../src/lib/stats/repos";
import { historicalIssue } from "./helpers";

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

const EMPTY_RESULT = { issues: [], pullRequests: [] };

/** A default mock for `../src/lib/stats/github-history-client`, overridable per test via spread. `fetchAllRepoRecentCommits` is unrelated to this file's own (issue/PR) scenarios, so it's stubbed the same way everywhere unless a test cares about it specifically. */
function mockHistoryClient(overrides: Record<string, unknown> = {}) {
  vi.doMock("../src/lib/stats/github-history-client", () => ({
    fetchAllRepoHistories: vi.fn(),
    fetchAllRepoHistoriesSince: vi.fn(),
    fetchAllRepoRecentCommits: vi.fn().mockResolvedValue([]),
    ...overrides,
  }));
}

function mockHistoryStore(overrides: Record<string, unknown> = {}) {
  vi.doMock("../src/lib/stats/history-store", () => ({
    readHistoryMeta: vi.fn().mockReturnValue(null),
    readHistoryStore: vi.fn().mockReturnValue(null),
    writeHistoryStore: vi.fn(),
    ...overrides,
  }));
}

function unmockAll(): void {
  vi.doUnmock("../src/lib/stats/github-history-client");
  vi.doUnmock("../src/lib/stats/history-store");
  vi.doUnmock("../src/lib/stats/recent-commits-cache");
  vi.doUnmock("../src/lib/stats/file-lock");
  vi.resetModules();
}

describe("loadHistoricalDataset", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.FIXTURE_DATA;
    // The real withFileLock touches the filesystem (mkdirSync/rmSync on data/history/.lock) —
    // irrelevant to this module's own logic, so bypass it rather than letting every test in this
    // file race on a real lock directory.
    vi.doMock("../src/lib/stats/file-lock", () => ({ withFileLock: (_lockDir: string, fn: () => unknown) => fn() }));
    // Recent-commit authors live in .cache/ now (see src/lib/stats/recent-commits-cache.ts) —
    // irrelevant to this file's issue/PR scenarios, so keep it off the real filesystem too.
    vi.doMock("../src/lib/stats/recent-commits-cache", () => ({
      readRecentCommitsCache: vi.fn().mockReturnValue(null),
      writeRecentCommitsCache: vi.fn(),
    }));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    unmockAll();
  });

  describe("with a token, no baseline yet (fresh checkout)", () => {
    beforeEach(() => {
      process.env.GITHUB_OAUTH_TOKEN = "test-token";
    });

    it("does a full fetch for every repo in STATS_REPOS, not an incremental one", async () => {
      const fetchAllRepoHistories = vi.fn().mockResolvedValue({ issues: [fullIssueNode()], pullRequests: [] });
      const fetchAllRepoHistoriesSince = vi.fn();
      mockHistoryClient({ fetchAllRepoHistories, fetchAllRepoHistoriesSince });
      const writeHistoryStore = vi.fn();
      mockHistoryStore({ writeHistoryStore });

      const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
      const dataset = await loadHistoricalDataset();

      expect(fetchAllRepoHistories).toHaveBeenCalledWith("test-token", STATS_REPOS);
      expect(fetchAllRepoHistoriesSince).not.toHaveBeenCalled();
      expect(dataset.issues).toHaveLength(1);
      expect(writeHistoryStore).toHaveBeenCalledTimes(1);
    });

    it("refuses to trust or persist a dataset with zero issues/PRs for the primary repo", async () => {
      mockHistoryClient({
        fetchAllRepoHistories: vi.fn().mockResolvedValue({
          // Some other (non-primary) repo came back fine, but metasploit-framework didn't.
          issues: [fullIssueNode({ project: "rex" })],
          pullRequests: [],
        }),
      });
      const writeHistoryStore = vi.fn();
      mockHistoryStore({ writeHistoryStore });

      const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
      await expect(loadHistoricalDataset()).rejects.toThrow(/metasploit-framework/);
      expect(writeHistoryStore).not.toHaveBeenCalled();
    });
  });

  describe("with a token and an existing baseline", () => {
    beforeEach(() => {
      process.env.GITHUB_OAUTH_TOKEN = "test-token";
    });

    it("does an incremental fetch (since the baseline's fetchedAt) for every repo, not a full one", async () => {
      const baseline = {
        issues: [historicalIssue({ project: "metasploit-framework", number: 1 })],
        recentCommitAuthors: [],
        fetchedAt: "2026-11-10T00:00:00Z",
      };
      const fetchAllRepoHistories = vi.fn();
      const fetchAllRepoHistoriesSince = vi.fn().mockResolvedValue(EMPTY_RESULT);
      mockHistoryClient({ fetchAllRepoHistories, fetchAllRepoHistoriesSince });
      const writeHistoryStore = vi.fn();
      mockHistoryStore({
        readHistoryMeta: vi.fn().mockReturnValue({ repos: STATS_REPOS, fetchedAt: baseline.fetchedAt }),
        readHistoryStore: vi.fn().mockReturnValue(baseline),
        writeHistoryStore,
      });

      const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
      const dataset = await loadHistoricalDataset();

      expect(fetchAllRepoHistoriesSince).toHaveBeenCalledWith("test-token", STATS_REPOS, baseline.fetchedAt);
      expect(fetchAllRepoHistories).not.toHaveBeenCalled();
      // Nothing changed upstream, but the baseline's own primary-repo issue still counts.
      expect(dataset.issues).toHaveLength(1);
      expect(writeHistoryStore).toHaveBeenCalledTimes(1);
    });

    it("merges the incremental delta over the baseline by (repo, number) — updates replace, new ones add, untouched ones survive", async () => {
      const untouched = historicalIssue({ project: "metasploit-framework", number: 1, title: "Untouched" });
      const stale = historicalIssue({ project: "metasploit-framework", number: 2, title: "Stale title", commentCount: 0 });
      const baseline = { issues: [untouched, stale], recentCommitAuthors: [], fetchedAt: "2026-11-10T00:00:00Z" };

      mockHistoryClient({
        fetchAllRepoHistoriesSince: vi.fn().mockResolvedValue({
          issues: [
            fullIssueNode({ number: 2, title: "Updated title", comments: { totalCount: 5 } }),
            fullIssueNode({ number: 3, title: "Brand new" }),
          ],
          pullRequests: [],
        }),
      });
      mockHistoryStore({
        readHistoryMeta: vi.fn().mockReturnValue({ repos: STATS_REPOS, fetchedAt: baseline.fetchedAt }),
        readHistoryStore: vi.fn().mockReturnValue(baseline),
      });

      const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
      const dataset = await loadHistoricalDataset();

      expect(dataset.issues).toHaveLength(3);
      const byNumber = new Map(dataset.issues.map((issue) => [issue.number, issue]));
      expect(byNumber.get(1)?.title).toBe("Untouched");
      expect(byNumber.get(2)?.title).toBe("Updated title");
      expect(byNumber.get(2)?.commentCount).toBe(5);
      expect(byNumber.get(3)?.title).toBe("Brand new");
    });

    it("tolerates an incremental fetch returning nothing for the primary repo — the baseline's own coverage still counts, so this isn't the zero-data failure case", async () => {
      const baseline = { issues: [historicalIssue({ project: "metasploit-framework", number: 1 })], recentCommitAuthors: [], fetchedAt: "2026-11-10T00:00:00Z" };
      mockHistoryClient({ fetchAllRepoHistoriesSince: vi.fn().mockResolvedValue(EMPTY_RESULT) });
      mockHistoryStore({
        readHistoryMeta: vi.fn().mockReturnValue({ repos: STATS_REPOS, fetchedAt: baseline.fetchedAt }),
        readHistoryStore: vi.fn().mockReturnValue(baseline),
      });

      const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
      await expect(loadHistoricalDataset()).resolves.toMatchObject({ issues: expect.arrayContaining([expect.objectContaining({ number: 1 })]) });
    });

    it("fetches recent-commit authors separately from issues/PRs, via the .cache/-backed cache, not merged into the baseline", async () => {
      const baseline = { issues: [historicalIssue({ project: "metasploit-framework", number: 1 })], recentCommitAuthors: [], fetchedAt: "2026-11-10T00:00:00Z" };
      const fetchAllRepoRecentCommits = vi.fn().mockResolvedValue([{ repo: "metasploit-framework", author: "alice" }]);
      const writeRecentCommitsCache = vi.fn();
      mockHistoryClient({ fetchAllRepoHistoriesSince: vi.fn().mockResolvedValue(EMPTY_RESULT), fetchAllRepoRecentCommits });
      mockHistoryStore({
        readHistoryMeta: vi.fn().mockReturnValue({ repos: STATS_REPOS, fetchedAt: baseline.fetchedAt }),
        readHistoryStore: vi.fn().mockReturnValue(baseline),
      });
      vi.doMock("../src/lib/stats/recent-commits-cache", () => ({
        readRecentCommitsCache: vi.fn().mockReturnValue(null),
        writeRecentCommitsCache,
      }));

      const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
      const dataset = await loadHistoricalDataset();

      expect(fetchAllRepoRecentCommits).toHaveBeenCalledWith("test-token", STATS_REPOS, expect.any(String));
      expect(writeRecentCommitsCache).toHaveBeenCalledWith(expect.any(String), STATS_REPOS, [{ repo: "metasploit-framework", author: "alice" }]);
      expect(dataset.recentCommitAuthors).toEqual([{ repo: "metasploit-framework", author: "alice" }]);
    });

    it("skips the live recent-commits fetch when the .cache/ entry is still fresh", async () => {
      const baseline = { issues: [historicalIssue({ project: "metasploit-framework", number: 1 })], recentCommitAuthors: [], fetchedAt: "2026-11-10T00:00:00Z" };
      const fetchAllRepoRecentCommits = vi.fn();
      mockHistoryClient({ fetchAllRepoHistoriesSince: vi.fn().mockResolvedValue(EMPTY_RESULT), fetchAllRepoRecentCommits });
      mockHistoryStore({
        readHistoryMeta: vi.fn().mockReturnValue({ repos: STATS_REPOS, fetchedAt: baseline.fetchedAt }),
        readHistoryStore: vi.fn().mockReturnValue(baseline),
      });
      vi.doMock("../src/lib/stats/recent-commits-cache", () => ({
        readRecentCommitsCache: vi.fn().mockReturnValue([{ repo: "rex", author: "bob" }]),
        writeRecentCommitsCache: vi.fn(),
      }));

      const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
      const dataset = await loadHistoricalDataset();

      expect(fetchAllRepoRecentCommits).not.toHaveBeenCalled();
      expect(dataset.recentCommitAuthors).toEqual([{ repo: "rex", author: "bob" }]);
    });
  });

  describe("with a token and a baseline missing some repos (e.g. STATS_REPOS grew)", () => {
    it("full-fetches only the new repos and incrementally tops up only the already-known ones", async () => {
      process.env.GITHUB_OAUTH_TOKEN = "test-token";
      const knownRepos = STATS_REPOS.slice(1);
      const newRepo = STATS_REPOS[0];
      const baseline = { issues: [historicalIssue({ project: "metasploit-framework", number: 1 })], recentCommitAuthors: [], fetchedAt: "2026-11-10T00:00:00Z" };

      const fetchAllRepoHistories = vi.fn().mockResolvedValue(EMPTY_RESULT);
      const fetchAllRepoHistoriesSince = vi.fn().mockResolvedValue(EMPTY_RESULT);
      mockHistoryClient({ fetchAllRepoHistories, fetchAllRepoHistoriesSince });
      mockHistoryStore({
        readHistoryMeta: vi.fn().mockReturnValue({ repos: knownRepos, fetchedAt: baseline.fetchedAt }),
        readHistoryStore: vi.fn().mockReturnValue(baseline),
      });

      const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
      await loadHistoricalDataset();

      expect(fetchAllRepoHistories).toHaveBeenCalledWith("test-token", [newRepo]);
      expect(fetchAllRepoHistoriesSince).toHaveBeenCalledWith("test-token", knownRepos, baseline.fetchedAt);
    });
  });

  describe("without a token", () => {
    it("uses the committed baseline as-is, however old, without attempting any fetch", async () => {
      const fetchAllRepoHistories = vi.fn();
      const fetchAllRepoHistoriesSince = vi.fn();
      mockHistoryClient({ fetchAllRepoHistories, fetchAllRepoHistoriesSince });
      const committedDataset = { issues: [historicalIssue()], recentCommitAuthors: [], fetchedAt: "2020-01-01T00:00:00Z" };
      mockHistoryStore({
        readHistoryMeta: vi.fn().mockReturnValue({ repos: STATS_REPOS, fetchedAt: committedDataset.fetchedAt }),
        readHistoryStore: vi.fn().mockReturnValue(committedDataset),
      });

      const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
      const dataset = await loadHistoricalDataset();
      expect(dataset).toEqual(committedDataset);
      expect(fetchAllRepoHistories).not.toHaveBeenCalled();
      expect(fetchAllRepoHistoriesSince).not.toHaveBeenCalled();
    });

    it("falls back to the .cache/ recent-commits entry regardless of its age — there's no live fetch to prefer instead", async () => {
      mockHistoryClient();
      const committedDataset = { issues: [historicalIssue()], recentCommitAuthors: [], fetchedAt: "2020-01-01T00:00:00Z" };
      mockHistoryStore({
        readHistoryMeta: vi.fn().mockReturnValue({ repos: STATS_REPOS, fetchedAt: committedDataset.fetchedAt }),
        readHistoryStore: vi.fn().mockReturnValue(committedDataset),
      });
      vi.doMock("../src/lib/stats/recent-commits-cache", () => ({
        readRecentCommitsCache: vi.fn().mockReturnValue([{ repo: "rex", author: "ancient" }]),
        writeRecentCommitsCache: vi.fn(),
      }));

      const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
      const dataset = await loadHistoricalDataset();
      expect(dataset.recentCommitAuthors).toEqual([{ repo: "rex", author: "ancient" }]);
    });

    it("throws when there's no committed baseline either", async () => {
      mockHistoryClient();
      mockHistoryStore();

      const { loadHistoricalDataset } = await import("../src/lib/stats/dataset");
      await expect(loadHistoricalDataset()).rejects.toThrow(/GITHUB_OAUTH_TOKEN/);
    });
  });
});
