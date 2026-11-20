import { readJsonFile, writeJsonFile } from "../vuln/json-store";

interface NameCacheEntry {
  name: string | null;
  cachedAt: string;
}

type NameCacheFile = Record<string, NameCacheEntry>;

/** A CWE's name essentially never changes once published, so this gets a long TTL — mirrors module-cwe-cache.ts's shape/rationale, keyed by CWE id instead of CVE id. */
export function readCweNameCache(path: string, cwe: string, ttlMs: number): string | null | undefined {
  if (ttlMs <= 0) return undefined;
  const entry = readJsonFile<NameCacheFile>(path)?.[cwe];
  if (!entry) return undefined;
  const age = Date.now() - Date.parse(entry.cachedAt);
  if (!Number.isFinite(age) || age > ttlMs) return undefined;
  return entry.name;
}

export function writeCweNameCache(path: string, cwe: string, name: string | null): void {
  const file = readJsonFile<NameCacheFile>(path) ?? {};
  file[cwe] = { name, cachedAt: new Date().toISOString() };
  writeJsonFile(path, file);
}
