import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface CacheFile {
  cachedAt: string;
  owner: string;
  repos: string[];
  counts: Record<string, number>;
}

function sameRepoSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((repo, index) => repo === sorted[index]);
}

/**
 * Reads a previously cached set of open-PR counts from disk, if present, fresh enough (within
 * `ttlMs`), and for the same owner/repo set. Returns null on any cache miss so the caller falls
 * back to a live fetch. `ttlMs <= 0` always misses (cache disabled).
 */
export function readPullRequestCountCache(path: string, owner: string, repos: string[], ttlMs: number): Record<string, number> | null {
  if (ttlMs <= 0 || !existsSync(path)) return null;

  let parsed: CacheFile;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }

  if (parsed.owner !== owner || !sameRepoSet(parsed.repos, repos)) return null;
  const age = Date.now() - Date.parse(parsed.cachedAt);
  if (!Number.isFinite(age) || age > ttlMs) return null;

  return parsed.counts;
}

export function writePullRequestCountCache(path: string, owner: string, repos: string[], counts: Record<string, number>): void {
  mkdirSync(dirname(path), { recursive: true });
  const payload: CacheFile = { cachedAt: new Date().toISOString(), owner, repos, counts };
  writeFileSync(path, JSON.stringify(payload));
}
