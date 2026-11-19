import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInBatches } from "../async";
import { fetchCweName } from "./cwe-names-client";
import { readCweNameCache, writeCweNameCache } from "./cwe-names-cache";

const CACHE_PATH = resolve(process.cwd(), ".cache", "cwe-names.json");
// A CWE's name essentially never changes once published, so this cache barely needs refreshing.
const CACHE_TTL_MINUTES = 10080;
const CONCURRENCY = 8;

function loadFixtureCweNames(): Record<string, string> {
  const fixturePath = resolve(process.cwd(), "fixtures/sample-cwe-names.json");
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}

async function resolveName(cwe: string): Promise<string | null> {
  const ttlMs = CACHE_TTL_MINUTES * 60_000;
  const cached = readCweNameCache(CACHE_PATH, cwe, ttlMs);
  if (cached !== undefined) return cached;

  try {
    const name = await fetchCweName(cwe);
    writeCweNameCache(CACHE_PATH, cwe, name);
    return name;
  } catch (error) {
    console.warn(`[stats] CWE name lookup failed for ${cwe}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Resolves human-readable names for exactly the CWE ids this build's charts need — not MITRE's
 * full ~1,500-entry catalog — caching each in `.cache/` (a CWE's name essentially never changes
 * once published) rather than committing a static snapshot that would silently go stale as MITRE
 * adds new ids. Fixture builds never touch the network, same as every other dataset here.
 */
export async function loadCweNames(cweIds: string[]): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(cweIds)];

  if (process.env.FIXTURE_DATA === "1") {
    const fixtureNames = loadFixtureCweNames();
    const names: Record<string, string> = {};
    for (const cwe of uniqueIds) {
      if (fixtureNames[cwe]) names[cwe] = fixtureNames[cwe];
    }
    return names;
  }

  const names: Record<string, string> = {};
  await runInBatches(uniqueIds, CONCURRENCY, async (cwe) => {
    const name = await resolveName(cwe);
    if (name) names[cwe] = name;
  });
  return names;
}
