import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { HistoricalDataset } from "./types";

interface CacheFile {
  repos: string[];
  dataset: HistoricalDataset;
}

function sameRepoSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((repo, index) => repo === sorted[index]);
}

/**
 * Reads a previously cached historical dataset from disk, if present, fresh enough (within
 * `ttlMs`), and for the same repo set. Returns null on any cache miss so the caller falls back to
 * a live fetch. `ttlMs <= 0` always misses (cache disabled). A mismatched repo set (e.g. after
 * editing STATS_REPOS) also misses, so stale data is never silently served for a changed list.
 */
export function readHistoryCache(path: string, repos: string[], ttlMs: number): HistoricalDataset | null {
  if (ttlMs <= 0 || !existsSync(path)) return null;

  let parsed: CacheFile;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }

  if (!sameRepoSet(parsed.repos, repos)) return null;
  const age = Date.now() - Date.parse(parsed.dataset.fetchedAt);
  if (!Number.isFinite(age) || age > ttlMs) return null;

  return parsed.dataset;
}

export function writeHistoryCache(path: string, repos: string[], dataset: HistoricalDataset): void {
  mkdirSync(dirname(path), { recursive: true });
  const payload: CacheFile = { repos, dataset };
  writeFileSync(path, JSON.stringify(payload));
}
