import { readJsonFile, writeJsonFile } from "./json-store";

const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const KEV_TTL_MS = 6 * 60 * 60 * 1000;

interface KevCacheFile {
  fetchedAt: string;
  ids: string[];
}

/**
 * Loads the CISA Known Exploited Vulnerabilities catalog (CVE ids only, no auth required),
 * refreshing from the gitignored on-disk cache if stale. Returns null (not an empty set) when
 * the feed has never been successfully fetched, so callers can distinguish "not known exploited"
 * from "we don't know."
 */
export async function loadKevSet(cachePath: string): Promise<Set<string> | null> {
  const cached = readJsonFile<KevCacheFile>(cachePath);
  const isFresh = cached && Date.now() - Date.parse(cached.fetchedAt) < KEV_TTL_MS;
  if (isFresh) return new Set(cached.ids);

  try {
    const response = await fetch(KEV_URL, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`CISA KEV feed error: ${response.status} ${response.statusText}`);
    const data = (await response.json()) as { vulnerabilities: Array<{ cveID: string }> };
    const ids = data.vulnerabilities.map((entry) => entry.cveID);
    writeJsonFile(cachePath, { fetchedAt: new Date().toISOString(), ids } satisfies KevCacheFile);
    return new Set(ids);
  } catch (error) {
    console.warn(`[vuln] Failed to refresh the CISA KEV feed: ${error instanceof Error ? error.message : String(error)}`);
    return cached ? new Set(cached.ids) : null;
  }
}
