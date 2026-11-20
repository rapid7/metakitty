import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInBatches } from "../async";
import { resolveGitHubToken } from "../github-token";
import { fetchFkieNvdWeaknesses } from "../vuln/fkie-nvd-client";
import { fetchModuleMetadata, type RawModuleMetadataEntry } from "./module-counts-client";
import { getCveDetailsByYear, getDistinctModuleCveRefs, tallyModuleCweCounts, type ModuleCweCount, type ModuleCweYearBreakdown } from "./module-counts";
import { readCweCache, writeCweCache } from "./module-cwe-cache";
import { readModuleCweNvdCache, writeModuleCweNvdCache, type ModuleCweNvdResult } from "./module-cwe-nvd-cache";

const CACHE_DIR = resolve(process.cwd(), ".cache");
const RESULT_CACHE_PATH = resolve(CACHE_DIR, "module-cwe-nvd.json");
const PER_CVE_CACHE_PATH = resolve(CACHE_DIR, "module-cwe-by-cve.json");
const DEFAULT_RESULT_CACHE_TTL_MINUTES = 1440;
// A CVE's NVD-classified CWE essentially never changes once published, so this cache barely needs
// refreshing — a long TTL just bounds how long a transient lookup failure (empty result) sticks.
const PER_CVE_CACHE_TTL_MINUTES = 10080;
const CONCURRENCY = 8;

function loadFixtureModuleMetadata(): RawModuleMetadataEntry[] {
  const fixturePath = resolve(process.cwd(), "fixtures/sample-module-metadata.json");
  const parsed = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, RawModuleMetadataEntry>;
  return Object.values(parsed);
}

/** Fixture builds never touch the network — this stands in for fetchFkieNvdWeaknesses with a small, hand-verified CVE→CWE table covering the fixture's own CVE references. */
function loadFixtureCwesByCve(): Record<string, string[]> {
  const fixturePath = resolve(process.cwd(), "fixtures/sample-nvd-weaknesses.json");
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}

async function resolveCwes(cveId: string): Promise<string[]> {
  const ttlMs = PER_CVE_CACHE_TTL_MINUTES * 60_000;
  const cached = readCweCache(PER_CVE_CACHE_PATH, cveId, ttlMs);
  if (cached) return cached;

  try {
    const cwes = await fetchFkieNvdWeaknesses(cveId);
    writeCweCache(PER_CVE_CACHE_PATH, cveId, cwes);
    return cwes;
  } catch (error) {
    console.warn(`[stats] CWE lookup failed for ${cveId}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function tallyByYear(yearDetails: { year: number; modules: { cveIds: string[] }[] }[], cwesByCve: Map<string, string[]> | Record<string, string[]>): ModuleCweYearBreakdown[] {
  const resolve = (id: string) => (cwesByCve instanceof Map ? cwesByCve.get(id) : cwesByCve[id]) ?? [];
  return yearDetails
    .map(({ year, modules }) => ({ year, counts: tallyModuleCweCounts(modules.map((m) => m.cveIds.flatMap(resolve))) }))
    .filter((group) => group.counts.length > 0);
}

let inFlight: Promise<ModuleCweNvdResult> | null = null;

/**
 * Histograms modules by CWE, resolved via NVD lookups of each module's CVE references rather than
 * relying on the module's own (thin) self-reported `CWE-` tags (see getModuleCounts' `cweCounts`
 * for that narrower, self-reported view) — both as a single total and broken down by the module's
 * disclosure year, computed together from one shared per-CVE resolution pass.
 */
export function loadModuleCweDataFromNvd(): Promise<ModuleCweNvdResult> {
  if (!inFlight) {
    inFlight = (async () => {
      if (process.env.FIXTURE_DATA === "1") {
        const metadata = loadFixtureModuleMetadata();
        const moduleRefs = getDistinctModuleCveRefs(metadata);
        const cwesByCve = loadFixtureCwesByCve();
        return {
          cweCounts: tallyModuleCweCounts(moduleRefs.map((m) => m.cveIds.flatMap((id) => cwesByCve[id] ?? []))),
          cweCountsByYear: tallyByYear(getCveDetailsByYear(metadata), cwesByCve),
        };
      }

      const ttlMinutes = Number(process.env.MODULE_COUNTS_CACHE_TTL_MINUTES ?? DEFAULT_RESULT_CACHE_TTL_MINUTES);
      const ttlMs = (Number.isFinite(ttlMinutes) ? ttlMinutes : DEFAULT_RESULT_CACHE_TTL_MINUTES) * 60_000;

      const cached = readModuleCweNvdCache(RESULT_CACHE_PATH, ttlMs);
      if (cached) {
        console.log(`[stats-cache] Using cached NVD-derived CWE counts (<= ${ttlMinutes}m old) from ${RESULT_CACHE_PATH}`);
        return cached;
      }

      const token = resolveGitHubToken();
      if (!token) {
        throw new Error("GITHUB_OAUTH_TOKEN or GITHUB_BASIC_AUTH must be set (or pass FIXTURE_DATA=1 to build from fixtures).");
      }
      const metadata = await fetchModuleMetadata(token);
      const moduleRefs = getDistinctModuleCveRefs(metadata);

      const uniqueCveIds = [...new Set(moduleRefs.flatMap((m) => m.cveIds))];
      console.log(`[stats] Resolving CWEs for ${uniqueCveIds.length} distinct CVEs referenced by modules...`);
      const cwesByCve = new Map<string, string[]>();
      await runInBatches(uniqueCveIds, CONCURRENCY, async (cveId) => {
        cwesByCve.set(cveId, await resolveCwes(cveId));
      });

      const result: ModuleCweNvdResult = {
        cweCounts: tallyModuleCweCounts(moduleRefs.map((m) => m.cveIds.flatMap((id) => cwesByCve.get(id) ?? []))),
        cweCountsByYear: tallyByYear(getCveDetailsByYear(metadata), cwesByCve),
      };
      writeModuleCweNvdCache(RESULT_CACHE_PATH, result);
      console.log(`[stats-cache] Wrote NVD-derived CWE counts to ${RESULT_CACHE_PATH}.`);
      return result;
    })();
    inFlight.catch(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
