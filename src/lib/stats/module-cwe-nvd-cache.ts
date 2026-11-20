import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ModuleCweCount, ModuleCweYearBreakdown } from "./module-counts";

export interface ModuleCweNvdResult {
  cweCounts: ModuleCweCount[];
  cweCountsByYear: ModuleCweYearBreakdown[];
}

interface CacheFile extends ModuleCweNvdResult {
  fetchedAt: string;
}

/** Mirrors module-counts-cache.ts's shape/rationale — caches the final histogram (totals and by-year) so a warm build skips both the 11MB metadata fetch and the per-CVE NVD resolution loop, not just individual CVE lookups (see module-cwe-cache.ts for that finer-grained cache). */
export function readModuleCweNvdCache(path: string, ttlMs: number): ModuleCweNvdResult | null {
  if (ttlMs <= 0 || !existsSync(path)) return null;

  let parsed: CacheFile;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }

  const age = Date.now() - Date.parse(parsed.fetchedAt);
  if (!Number.isFinite(age) || age > ttlMs) return null;
  if (!Array.isArray(parsed.cweCounts)) return null;
  if (!Array.isArray(parsed.cweCountsByYear)) return null;

  return { cweCounts: parsed.cweCounts, cweCountsByYear: parsed.cweCountsByYear };
}

export function writeModuleCweNvdCache(path: string, result: ModuleCweNvdResult): void {
  mkdirSync(dirname(path), { recursive: true });
  const payload: CacheFile = { fetchedAt: new Date().toISOString(), ...result };
  writeFileSync(path, JSON.stringify(payload));
}
