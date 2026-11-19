import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readCweNameCache, writeCweNameCache } from "../src/lib/stats/cwe-names-cache";

let dir: string;
let cachePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cwe-names-cache-test-"));
  cachePath = join(dir, "nested", "cwe-names.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

it("returns undefined when no cache file exists", () => {
  expect(readCweNameCache(cachePath, "CWE-89", 60_000)).toBeUndefined();
});

it("round-trips a write/read, creating nested directories", () => {
  writeCweNameCache(cachePath, "CWE-89", "Improper Neutralization of Special Elements used in an SQL Command");
  expect(readCweNameCache(cachePath, "CWE-89", 60_000)).toBe("Improper Neutralization of Special Elements used in an SQL Command");
});

it("caches a confirmed-unresolvable id (null) distinctly from a cache miss (undefined)", () => {
  writeCweNameCache(cachePath, "CWE-99999", null);
  expect(readCweNameCache(cachePath, "CWE-99999", 60_000)).toBeNull();
});

it("misses for an id that was never written, alongside one that was", () => {
  writeCweNameCache(cachePath, "CWE-89", "SQL Injection");
  expect(readCweNameCache(cachePath, "CWE-999", 60_000)).toBeUndefined();
});

it("misses when the TTL has expired", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  const staleCachedAt = new Date(Date.now() - 120_000).toISOString();
  writeFileSync(cachePath, JSON.stringify({ "CWE-89": { name: "SQL Injection", cachedAt: staleCachedAt } }));
  expect(readCweNameCache(cachePath, "CWE-89", 60_000)).toBeUndefined();
});

it("treats a TTL of zero or less as disabled", () => {
  writeCweNameCache(cachePath, "CWE-89", "SQL Injection");
  expect(readCweNameCache(cachePath, "CWE-89", 0)).toBeUndefined();
});

it("misses gracefully on corrupt (non-JSON) cache contents", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  writeFileSync(cachePath, "not valid json");
  expect(readCweNameCache(cachePath, "CWE-89", 60_000)).toBeUndefined();
});
