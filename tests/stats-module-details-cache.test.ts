import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readModuleDetailsCache, writeModuleDetailsCache } from "../src/lib/stats/module-details-cache";
import type { ModuleDetail } from "../src/lib/stats/module-details";

let dir: string;
let cachePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "module-details-cache-test-"));
  cachePath = join(dir, "nested", "module-details.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function moduleDetails(): Map<string, ModuleDetail> {
  const detail: ModuleDetail = {
    fullname: "auxiliary/admin/foo",
    name: "Foo",
    type: "auxiliary",
    rank: 300,
    rankLabel: "Normal",
    author: [],
    description: "",
    platform: "",
    arch: "",
    disclosureDate: null,
    targets: null,
    references: [],
    notes: {},
    check: false,
    postAuth: false,
    defaultCredential: false,
    slugSegments: ["auxiliary", "admin", "foo"],
  };
  return new Map([[detail.fullname, detail]]);
}

it("returns null when no cache file exists", () => {
  expect(readModuleDetailsCache(cachePath, 60_000)).toBeNull();
});

it("round-trips a write/read, creating nested directories", () => {
  writeModuleDetailsCache(cachePath, moduleDetails());
  expect(readModuleDetailsCache(cachePath, 60_000)).toEqual(moduleDetails());
});

it("misses when the TTL has expired", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  const staleFetchedAt = new Date(Date.now() - 120_000).toISOString();
  writeFileSync(cachePath, JSON.stringify({ fetchedAt: staleFetchedAt, moduleDetails: [...moduleDetails().entries()] }));
  expect(readModuleDetailsCache(cachePath, 60_000)).toBeNull();
});

it("treats a TTL of zero or less as disabled", () => {
  writeModuleDetailsCache(cachePath, moduleDetails());
  expect(readModuleDetailsCache(cachePath, 0)).toBeNull();
});

it("misses gracefully on corrupt (non-JSON) cache contents", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  writeFileSync(cachePath, "not valid json");
  expect(readModuleDetailsCache(cachePath, 60_000)).toBeNull();
});

it("misses when a cache written by an older schema is missing a field the current code expects", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  writeFileSync(cachePath, JSON.stringify({ fetchedAt: new Date().toISOString() }));
  expect(readModuleDetailsCache(cachePath, 60_000)).toBeNull();
});
