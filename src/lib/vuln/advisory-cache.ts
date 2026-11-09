import { readJsonFile, writeJsonFile } from "./json-store";

export interface AdvisoryResult {
  cvssScore: number | null;
  cvssVector: string | null;
  cvssVersion: string | null;
  source: "osv" | "fkie-nvd-mirror" | "nvd" | null;
  status: "scored" | "no_score" | "not_found" | "lookup_failed";
  cveAliases: string[];
}

interface AdvisoryCacheEntry extends AdvisoryResult {
  cachedAt: string;
}

type AdvisoryCacheFile = Record<string, AdvisoryCacheEntry>;

/** Advisory data (CVSS/CVE aliases) is keyed by CVE/GHSA id and rarely changes once published, so this gets a long TTL. */
export function readAdvisoryCache(path: string, id: string, ttlMs: number): AdvisoryResult | null {
  if (ttlMs <= 0) return null;
  const entry = readJsonFile<AdvisoryCacheFile>(path)?.[id];
  if (!entry) return null;
  const age = Date.now() - Date.parse(entry.cachedAt);
  if (!Number.isFinite(age) || age > ttlMs) return null;
  return entry;
}

export function writeAdvisoryCache(path: string, id: string, result: AdvisoryResult): void {
  const file = readJsonFile<AdvisoryCacheFile>(path) ?? {};
  file[id] = { ...result, cachedAt: new Date().toISOString() };
  writeJsonFile(path, file);
}
