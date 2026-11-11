import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ModuleCounts } from "./module-counts";

interface CacheFile {
  fetchedAt: string;
  moduleCounts: ModuleCounts;
}

/**
 * Reads a previously cached module-counts result from disk, if present and fresh enough (within
 * `ttlMs`). Returns null on any cache miss so the caller falls back to a live fetch. `ttlMs <= 0`
 * always misses (cache disabled). Unlike {@link readHistoryCache}, there's no repo-set dimension
 * to invalidate on — module counts always come from one fixed repo/ref.
 */
export function readModuleCountsCache(path: string, ttlMs: number): ModuleCounts | null {
  if (ttlMs <= 0 || !existsSync(path)) return null;

  let parsed: CacheFile;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }

  const age = Date.now() - Date.parse(parsed.fetchedAt);
  if (!Number.isFinite(age) || age > ttlMs) return null;

  return parsed.moduleCounts;
}

export function writeModuleCountsCache(path: string, moduleCounts: ModuleCounts): void {
  mkdirSync(dirname(path), { recursive: true });
  const payload: CacheFile = { fetchedAt: new Date().toISOString(), moduleCounts };
  writeFileSync(path, JSON.stringify(payload));
}
