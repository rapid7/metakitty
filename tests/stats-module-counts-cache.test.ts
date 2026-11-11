import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readModuleCountsCache, writeModuleCountsCache } from "../src/lib/stats/module-counts-cache";
import type { ModuleCounts } from "../src/lib/stats/module-counts";

let dir: string;
let cachePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "module-counts-cache-test-"));
  cachePath = join(dir, "nested", "module-counts.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function moduleCounts(): ModuleCounts {
  return { totalCount: 1, countsByType: [], tree: [] };
}

it("returns null when no cache file exists", () => {
  expect(readModuleCountsCache(cachePath, 60_000)).toBeNull();
});

it("round-trips a write/read, creating nested directories", () => {
  writeModuleCountsCache(cachePath, moduleCounts());
  expect(readModuleCountsCache(cachePath, 60_000)).toEqual(moduleCounts());
});

it("misses when the TTL has expired", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  const staleFetchedAt = new Date(Date.now() - 120_000).toISOString();
  writeFileSync(cachePath, JSON.stringify({ fetchedAt: staleFetchedAt, moduleCounts: moduleCounts() }));
  expect(readModuleCountsCache(cachePath, 60_000)).toBeNull();
});

it("treats a TTL of zero or less as disabled", () => {
  writeModuleCountsCache(cachePath, moduleCounts());
  expect(readModuleCountsCache(cachePath, 0)).toBeNull();
});

it("misses gracefully on corrupt (non-JSON) cache contents", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  writeFileSync(cachePath, "not valid json");
  expect(readModuleCountsCache(cachePath, 60_000)).toBeNull();
});
