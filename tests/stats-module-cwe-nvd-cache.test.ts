import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readModuleCweNvdCache, writeModuleCweNvdCache, type ModuleCweNvdResult } from "../src/lib/stats/module-cwe-nvd-cache";

let dir: string;
let cachePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "module-cwe-nvd-cache-test-"));
  cachePath = join(dir, "nested", "module-cwe-nvd.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function result(): ModuleCweNvdResult {
  return {
    cweCounts: [{ cwe: "CWE-89", count: 2 }],
    cweCountsByYear: [{ year: 2020, counts: [{ cwe: "CWE-89", count: 2 }] }],
  };
}

it("returns null when no cache file exists", () => {
  expect(readModuleCweNvdCache(cachePath, 60_000)).toBeNull();
});

it("round-trips a write/read, creating nested directories", () => {
  writeModuleCweNvdCache(cachePath, result());
  expect(readModuleCweNvdCache(cachePath, 60_000)).toEqual(result());
});

it("misses when the TTL has expired", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  const staleFetchedAt = new Date(Date.now() - 120_000).toISOString();
  writeFileSync(cachePath, JSON.stringify({ fetchedAt: staleFetchedAt, ...result() }));
  expect(readModuleCweNvdCache(cachePath, 60_000)).toBeNull();
});

it("treats a TTL of zero or less as disabled", () => {
  writeModuleCweNvdCache(cachePath, result());
  expect(readModuleCweNvdCache(cachePath, 0)).toBeNull();
});

it("misses gracefully on corrupt (non-JSON) cache contents", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  writeFileSync(cachePath, "not valid json");
  expect(readModuleCweNvdCache(cachePath, 60_000)).toBeNull();
});

it("misses when a cache predates the `cweCountsByYear` field (even though cweCounts is present)", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  writeFileSync(cachePath, JSON.stringify({ fetchedAt: new Date().toISOString(), cweCounts: result().cweCounts }));
  expect(readModuleCweNvdCache(cachePath, 60_000)).toBeNull();
});
