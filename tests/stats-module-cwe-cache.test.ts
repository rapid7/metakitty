import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readCweCache, writeCweCache } from "../src/lib/stats/module-cwe-cache";

let dir: string;
let cachePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "module-cwe-cache-test-"));
  cachePath = join(dir, "nested", "module-cwe-by-cve.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

it("returns null when no cache file exists", () => {
  expect(readCweCache(cachePath, "CVE-2020-0001", 60_000)).toBeNull();
});

it("round-trips a write/read, creating nested directories", () => {
  writeCweCache(cachePath, "CVE-2020-0001", ["CWE-89"]);
  expect(readCweCache(cachePath, "CVE-2020-0001", 60_000)).toEqual(["CWE-89"]);
});

it("caches an empty result (no CWE found) distinctly from a cache miss", () => {
  writeCweCache(cachePath, "CVE-2020-0001", []);
  expect(readCweCache(cachePath, "CVE-2020-0001", 60_000)).toEqual([]);
});

it("misses for an id that was never written, alongside one that was", () => {
  writeCweCache(cachePath, "CVE-2020-0001", ["CWE-89"]);
  expect(readCweCache(cachePath, "CVE-2020-9999", 60_000)).toBeNull();
});

it("misses when the TTL has expired", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  const staleCachedAt = new Date(Date.now() - 120_000).toISOString();
  writeFileSync(cachePath, JSON.stringify({ "CVE-2020-0001": { cwes: ["CWE-89"], cachedAt: staleCachedAt } }));
  expect(readCweCache(cachePath, "CVE-2020-0001", 60_000)).toBeNull();
});

it("treats a TTL of zero or less as disabled", () => {
  writeCweCache(cachePath, "CVE-2020-0001", ["CWE-89"]);
  expect(readCweCache(cachePath, "CVE-2020-0001", 0)).toBeNull();
});

it("misses gracefully on corrupt (non-JSON) cache contents", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  writeFileSync(cachePath, "not valid json");
  expect(readCweCache(cachePath, "CVE-2020-0001", 60_000)).toBeNull();
});
