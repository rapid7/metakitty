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

  // A cache written by an older schema (missing a field the current code expects) is a miss too,
  // not a crash waiting to happen downstream. Every tree node (leaf or folder) carries a
  // `fullname` key (string or null) as of the schema that added it; a cache from before that
  // change has no such key on any node, which `=== undefined` catches (unlike `null`).
  if (!Array.isArray(parsed.moduleCounts?.cveCountsByYear)) return null;
  if (!Array.isArray(parsed.moduleCounts?.cweCounts)) return null;
  if (!Array.isArray(parsed.moduleCounts?.cveDetailsByYear)) return null;
  const [firstNode] = parsed.moduleCounts.tree ?? [];
  if (firstNode && firstNode.fullname === undefined) return null;
  // Every module entry under cveDetailsByYear carries a `path` key as of the schema that added
  // it (used to link out to the module's GitHub source); a cache from before that change has no
  // such key, which `=== undefined` catches.
  const [firstYearGroup] = parsed.moduleCounts.cveDetailsByYear;
  const [firstModule] = firstYearGroup?.modules ?? [];
  if (firstModule && firstModule.path === undefined) return null;

  return parsed.moduleCounts;
}

export function writeModuleCountsCache(path: string, moduleCounts: ModuleCounts): void {
  mkdirSync(dirname(path), { recursive: true });
  const payload: CacheFile = { fetchedAt: new Date().toISOString(), moduleCounts };
  writeFileSync(path, JSON.stringify(payload));
}
