import { readJsonFile, writeJsonFile } from "../vuln/json-store";

interface CweCacheEntry {
  cwes: string[];
  cachedAt: string;
}

type CweCacheFile = Record<string, CweCacheEntry>;

/** A CVE's NVD-classified CWE essentially never changes once published, so this gets a long TTL — mirrors advisory-cache.ts's shape/rationale, keyed by CVE id instead. */
export function readCweCache(path: string, cveId: string, ttlMs: number): string[] | null {
  if (ttlMs <= 0) return null;
  const entry = readJsonFile<CweCacheFile>(path)?.[cveId];
  if (!entry) return null;
  const age = Date.now() - Date.parse(entry.cachedAt);
  if (!Number.isFinite(age) || age > ttlMs) return null;
  return entry.cwes;
}

export function writeCweCache(path: string, cveId: string, cwes: string[]): void {
  const file = readJsonFile<CweCacheFile>(path) ?? {};
  file[cveId] = { cwes, cachedAt: new Date().toISOString() };
  writeJsonFile(path, file);
}
