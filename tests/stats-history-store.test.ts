import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFreshHistoryStore, readHistoryStore, writeHistoryStore } from "../src/lib/stats/history-store";
import { historicalIssue } from "./helpers";
import type { HistoricalDataset } from "../src/lib/stats/types";

const NOW = new Date("2026-11-10T12:00:00Z");
const repos = ["metasploit-framework", "rex"];

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "history-store-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// readFreshHistoryStore's TTL check is against the real wall clock, not the injectable `now` used
// for createdAt-year bucketing — so a "fresh" fetchedAt here must be the real current time, not NOW.
function dataset(issues: ReturnType<typeof historicalIssue>[], fetchedAt = new Date().toISOString()): HistoricalDataset {
  return { issues, recentCommitAuthors: [{ repo: "rex", author: "alice" }], fetchedAt };
}

describe("writeHistoryStore + readHistoryStore (lax)", () => {
  it("round-trips issues across repos and years, plus recentCommitAuthors", () => {
    const a = historicalIssue({ number: 1, project: "metasploit-framework", state: "closed", createdAt: "2020-01-01T00:00:00Z" });
    const b = historicalIssue({ number: 2, project: "rex", state: "open", createdAt: "2015-01-01T00:00:00Z" });
    const ds = dataset([a, b]);

    writeHistoryStore(dir, repos, ds, NOW);
    const read = readHistoryStore(dir);

    expect(read?.fetchedAt).toBe(ds.fetchedAt);
    expect(read?.recentCommitAuthors).toEqual(ds.recentCommitAuthors);
    expect(read?.issues).toEqual(expect.arrayContaining([a, b]));
    expect(read?.issues).toHaveLength(2);
  });

  it("writes a frozen-<year>.json for closed/elapsed items and a hot-<year>.json for everything else", () => {
    const closed = historicalIssue({ number: 1, project: "rex", state: "closed", createdAt: "2020-01-01T00:00:00Z" });
    const open = historicalIssue({ number: 2, project: "rex", state: "open", createdAt: "2015-01-01T00:00:00Z" });

    writeHistoryStore(dir, repos, dataset([closed, open]), NOW);

    expect(existsSync(join(dir, "rex", "frozen-2020.json"))).toBe(true);
    expect(existsSync(join(dir, "rex", "hot-2015.json"))).toBe(true);
  });

  it("deletes a hot-<year>.json that's gone empty — its last open item finally closed, folding into frozen-<year>.json instead", () => {
    const open2015 = historicalIssue({ number: 1, project: "rex", state: "open", createdAt: "2015-01-01T00:00:00Z" });
    writeHistoryStore(dir, repos, dataset([open2015]), NOW);
    expect(existsSync(join(dir, "rex", "hot-2015.json"))).toBe(true);

    const nowClosed = { ...open2015, state: "closed" as const, closedAt: "2026-01-01T00:00:00Z" };
    writeHistoryStore(dir, repos, dataset([nowClosed]), NOW);

    expect(existsSync(join(dir, "rex", "hot-2015.json"))).toBe(false);
    expect(existsSync(join(dir, "rex", "frozen-2015.json"))).toBe(true);
  });

  it("deletes a repo's whole directory when it's no longer in the repos list", () => {
    writeHistoryStore(dir, repos, dataset([historicalIssue({ project: "rex", createdAt: "2020-01-01T00:00:00Z", state: "closed" })]), NOW);
    expect(existsSync(join(dir, "rex"))).toBe(true);

    writeHistoryStore(dir, ["metasploit-framework"], dataset([]), NOW);
    expect(existsSync(join(dir, "rex"))).toBe(false);
  });

  it("readHistoryStore returns null when meta.json doesn't exist", () => {
    expect(readHistoryStore(dir)).toBeNull();
  });

  it("readHistoryStore tolerates a corrupt individual bucket file, skipping just that file", () => {
    writeHistoryStore(dir, repos, dataset([historicalIssue({ project: "rex", createdAt: "2020-01-01T00:00:00Z", state: "closed" })]), NOW);
    mkdirSync(join(dir, "metasploit-framework"), { recursive: true });
    writeFileSync(join(dir, "metasploit-framework", "frozen-2019.json"), "not valid json");

    const read = readHistoryStore(dir);
    expect(read?.issues).toHaveLength(1);
  });

  it("readHistoryStore ignores staleness and repo-set mismatches — returns whatever's committed", () => {
    writeHistoryStore(dir, repos, dataset([], new Date(0).toISOString()), NOW);
    expect(readHistoryStore(dir)).not.toBeNull();
  });
});

describe("readFreshHistoryStore (strict)", () => {
  it("returns null when meta.json doesn't exist", () => {
    expect(readFreshHistoryStore(dir, repos, 60_000)).toBeNull();
  });

  it("hits when fresh and the repo set matches (order-insensitive)", () => {
    writeHistoryStore(dir, repos, dataset([]), NOW);
    expect(readFreshHistoryStore(dir, [...repos].reverse(), 60_000)).not.toBeNull();
  });

  it("misses when the TTL has expired", () => {
    writeHistoryStore(dir, repos, dataset([], new Date(NOW.getTime() - 120_000).toISOString()), NOW);
    expect(readFreshHistoryStore(dir, repos, 60_000)).toBeNull();
  });

  it("treats a TTL of zero or less as disabled", () => {
    writeHistoryStore(dir, repos, dataset([]), NOW);
    expect(readFreshHistoryStore(dir, repos, 0)).toBeNull();
  });

  it("misses when the repo set doesn't match (e.g. STATS_REPOS was edited)", () => {
    writeHistoryStore(dir, repos, dataset([]), NOW);
    expect(readFreshHistoryStore(dir, ["metasploit-framework"], 60_000)).toBeNull();
    expect(readFreshHistoryStore(dir, [...repos, "mettle"], 60_000)).toBeNull();
  });
});
