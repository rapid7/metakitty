import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readAdvisoryCache, writeAdvisoryCache, type AdvisoryResult } from "../src/lib/vuln/advisory-cache";
import { readModuleRefCache, writeModuleRefCache } from "../src/lib/vuln/module-ref-cache";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "vuln-cache-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const sampleAdvisory: AdvisoryResult = {
  cvssScore: 9.8,
  cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
  cvssVersion: "3.1",
  source: "osv",
  status: "scored",
  cveAliases: ["CVE-2026-1234"],
};

describe("advisory cache", () => {
  it("returns null when nothing is cached", () => {
    const path = join(dir, "advisories.json");
    expect(readAdvisoryCache(path, "CVE-2026-1234", 60_000)).toBeNull();
  });

  it("round-trips a write/read for the same id", () => {
    const path = join(dir, "advisories.json");
    writeAdvisoryCache(path, "CVE-2026-1234", sampleAdvisory);
    expect(readAdvisoryCache(path, "CVE-2026-1234", 60_000)).toMatchObject(sampleAdvisory);
  });

  it("supports multiple independent ids in one file", () => {
    const path = join(dir, "advisories.json");
    writeAdvisoryCache(path, "CVE-2026-1234", sampleAdvisory);
    writeAdvisoryCache(path, "GHSA-aaaa-bbbb-cccc", { ...sampleAdvisory, cvssScore: 4.3 });
    expect(readAdvisoryCache(path, "CVE-2026-1234", 60_000)?.cvssScore).toBe(9.8);
    expect(readAdvisoryCache(path, "GHSA-aaaa-bbbb-cccc", 60_000)?.cvssScore).toBe(4.3);
  });

  it("misses when the TTL has expired or is disabled", () => {
    const path = join(dir, "advisories.json");
    writeAdvisoryCache(path, "CVE-2026-1234", sampleAdvisory);
    expect(readAdvisoryCache(path, "CVE-2026-1234", -1)).toBeNull();
    expect(readAdvisoryCache(path, "CVE-2026-1234", 0)).toBeNull();
  });

  it("misses gracefully on corrupt cache contents", () => {
    const path = join(dir, "advisories.json");
    writeFileSync(path, "not valid json");
    expect(readAdvisoryCache(path, "CVE-2026-1234", 60_000)).toBeNull();
  });
});

describe("module ref cache", () => {
  it("is keyed by owner/repo/number/head SHA and never expires", () => {
    const path = join(dir, "module-vuln-refs.json");
    expect(readModuleRefCache(path, "rapid7", "metasploit-framework", 1, "sha-a")).toBeNull();

    writeModuleRefCache(path, "rapid7", "metasploit-framework", 1, "sha-a", ["CVE-2026-1234"]);
    expect(readModuleRefCache(path, "rapid7", "metasploit-framework", 1, "sha-a")).toEqual(["CVE-2026-1234"]);

    // A new commit on the same PR (different head SHA) is a cache miss, not a stale hit.
    expect(readModuleRefCache(path, "rapid7", "metasploit-framework", 1, "sha-b")).toBeNull();
  });
});
