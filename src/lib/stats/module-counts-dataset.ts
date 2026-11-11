import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getModuleCounts, type ModuleCounts } from "./module-counts";
import { readModuleCountsCache, writeModuleCountsCache } from "./module-counts-cache";
import { fetchModuleMetadata, type RawModuleMetadataEntry } from "./module-counts-client";
import { resolveGitHubToken } from "../github-token";

const CACHE_DIR = resolve(process.cwd(), ".cache");
const MODULE_COUNTS_CACHE_PATH = resolve(CACHE_DIR, "module-counts.json");
const DEFAULT_CACHE_TTL_MINUTES = 1440;

/** Mirrors modules_metadata_base.json's own shape: an object keyed by ref_name, not an array. */
function loadFixtureModuleMetadata(): RawModuleMetadataEntry[] {
  const fixturePath = resolve(process.cwd(), "fixtures/sample-module-metadata.json");
  const parsed = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, RawModuleMetadataEntry>;
  return Object.values(parsed);
}

let inFlight: Promise<ModuleCounts> | null = null;

/** Loads module type/category counts, shared (via an in-flight singleton) across every Dashboard page rendered in this process. */
export function loadModuleCounts(): Promise<ModuleCounts> {
  if (!inFlight) {
    inFlight = (async () => {
      if (process.env.FIXTURE_DATA === "1") {
        return getModuleCounts(loadFixtureModuleMetadata());
      }

      const ttlMinutes = Number(process.env.MODULE_COUNTS_CACHE_TTL_MINUTES ?? DEFAULT_CACHE_TTL_MINUTES);
      const ttlMs = (Number.isFinite(ttlMinutes) ? ttlMinutes : DEFAULT_CACHE_TTL_MINUTES) * 60_000;

      const cached = readModuleCountsCache(MODULE_COUNTS_CACHE_PATH, ttlMs);
      if (cached) {
        console.log(`[stats-cache] Using cached module counts (<= ${ttlMinutes}m old) from ${MODULE_COUNTS_CACHE_PATH}`);
        return cached;
      }

      const token = resolveGitHubToken();
      if (!token) {
        throw new Error("GITHUB_OAUTH_TOKEN or GITHUB_BASIC_AUTH must be set (or pass FIXTURE_DATA=1 to build from fixtures).");
      }
      console.log("[stats] No fresh module-counts cache; fetching metasploit-framework's module metadata (~11MB) from GitHub...");
      const metadata = await fetchModuleMetadata(token);
      console.log(`[stats] Fetched metadata for ${metadata.length} modules.`);
      const moduleCounts = getModuleCounts(metadata);

      writeModuleCountsCache(MODULE_COUNTS_CACHE_PATH, moduleCounts);
      console.log(`[stats-cache] Wrote module counts to ${MODULE_COUNTS_CACHE_PATH}.`);
      return moduleCounts;
    })();
    inFlight.catch(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
