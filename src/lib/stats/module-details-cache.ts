import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ModuleDetail } from "./module-details";

interface CacheFile {
  fetchedAt: string;
  moduleDetails: [string, ModuleDetail][];
}

/**
 * Reads a previously cached module-details result from disk, if present and fresh enough (within
 * `ttlMs`). Returns null on any cache miss so the caller falls back to a live fetch. `ttlMs <= 0`
 * always misses (cache disabled).
 */
export function readModuleDetailsCache(path: string, ttlMs: number): Map<string, ModuleDetail> | null {
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
  // not a crash waiting to happen downstream.
  if (!Array.isArray(parsed.moduleDetails)) return null;

  return new Map(parsed.moduleDetails);
}

export function writeModuleDetailsCache(path: string, moduleDetails: Map<string, ModuleDetail>): void {
  mkdirSync(dirname(path), { recursive: true });
  const payload: CacheFile = { fetchedAt: new Date().toISOString(), moduleDetails: [...moduleDetails.entries()] };
  writeFileSync(path, JSON.stringify(payload));
}
