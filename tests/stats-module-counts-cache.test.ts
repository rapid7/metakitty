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
  return { totalCount: 1, countsByType: [], tree: [], cveCountsByYear: [], cveDetailsByYear: [], cweCounts: [] };
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

it("misses when a cache written by an older schema is missing a field the current code expects", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  const legacyModuleCounts = { totalCount: 1, countsByType: [], tree: [] };
  writeFileSync(cachePath, JSON.stringify({ fetchedAt: new Date().toISOString(), moduleCounts: legacyModuleCounts }));
  expect(readModuleCountsCache(cachePath, 60_000)).toBeNull();
});

it("misses when a cached tree's nodes predate the `fullname` field (even though cveCountsByYear is present)", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  const legacyModuleCounts = {
    totalCount: 1,
    countsByType: [],
    cveCountsByYear: [],
    tree: [{ name: "auxiliary", total: 1, modulePath: null, children: [{ name: "foo", total: 1, modulePath: "modules/auxiliary/foo.rb", children: [] }] }],
  };
  writeFileSync(cachePath, JSON.stringify({ fetchedAt: new Date().toISOString(), moduleCounts: legacyModuleCounts }));
  expect(readModuleCountsCache(cachePath, 60_000)).toBeNull();
});

it("misses when a cache predates the `cveDetailsByYear` field (even though cveCountsByYear/cweCounts are present)", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  const legacyModuleCounts = { totalCount: 1, countsByType: [], tree: [], cveCountsByYear: [], cweCounts: [] };
  writeFileSync(cachePath, JSON.stringify({ fetchedAt: new Date().toISOString(), moduleCounts: legacyModuleCounts }));
  expect(readModuleCountsCache(cachePath, 60_000)).toBeNull();
});

it("misses when cveDetailsByYear's modules predate the `path` field (even though the array itself is present)", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  const legacyModuleCounts = {
    totalCount: 1,
    countsByType: [],
    tree: [],
    cveCountsByYear: [],
    cweCounts: [],
    cveDetailsByYear: [{ year: 2017, modules: [{ fullname: "exploit/windows/smb/ms17_010_eternalblue", cveIds: ["CVE-2017-0144"] }] }],
  };
  writeFileSync(cachePath, JSON.stringify({ fetchedAt: new Date().toISOString(), moduleCounts: legacyModuleCounts }));
  expect(readModuleCountsCache(cachePath, 60_000)).toBeNull();
});
