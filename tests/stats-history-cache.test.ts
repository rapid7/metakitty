import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readHistoryCache, writeHistoryCache } from "../src/lib/stats/history-cache";
import type { HistoricalDataset } from "../src/lib/stats/types";

let dir: string;
let cachePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "history-cache-test-"));
  cachePath = join(dir, "nested", "github-historical-issues.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function dataset(fetchedAt = new Date().toISOString()): HistoricalDataset {
  return { issues: [], recentCommitAuthors: [], fetchedAt };
}

const repos = ["metasploit-framework", "rex"];

it("returns null when no cache file exists", () => {
  expect(readHistoryCache(cachePath, repos, 60_000)).toBeNull();
});

it("round-trips a write/read for the same repo set, creating nested directories", () => {
  writeHistoryCache(cachePath, repos, dataset());
  expect(readHistoryCache(cachePath, repos, 60_000)).not.toBeNull();
});

it("is insensitive to repo set ordering", () => {
  writeHistoryCache(cachePath, repos, dataset());
  expect(readHistoryCache(cachePath, [...repos].reverse(), 60_000)).not.toBeNull();
});

it("misses when the TTL has expired", () => {
  writeHistoryCache(cachePath, repos, dataset(new Date(Date.now() - 120_000).toISOString()));
  expect(readHistoryCache(cachePath, repos, 60_000)).toBeNull();
});

it("treats a TTL of zero or less as disabled", () => {
  writeHistoryCache(cachePath, repos, dataset());
  expect(readHistoryCache(cachePath, repos, 0)).toBeNull();
});

it("misses when the repo set doesn't match (e.g. STATS_REPOS was edited)", () => {
  writeHistoryCache(cachePath, repos, dataset());
  expect(readHistoryCache(cachePath, ["metasploit-framework"], 60_000)).toBeNull();
  expect(readHistoryCache(cachePath, [...repos, "mettle"], 60_000)).toBeNull();
});

it("misses gracefully on corrupt (non-JSON) cache contents", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  writeFileSync(cachePath, "not valid json");
  expect(readHistoryCache(cachePath, repos, 60_000)).toBeNull();
});
