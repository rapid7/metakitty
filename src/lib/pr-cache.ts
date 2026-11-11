import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RawPullRequestNode } from "./github-client";

interface CacheFile {
  cachedAt: string;
  owner: string;
  repo: string;
  pullRequests: RawPullRequestNode[];
}

/**
 * Reads a previously cached GraphQL response from disk, if present, fresh enough
 * (within `ttlMs`), and for the same owner/repo. Returns null on any cache miss
 * so the caller falls back to a live fetch. `ttlMs <= 0` always misses (cache disabled).
 */
export function readPullRequestCache(path: string, owner: string, repo: string, ttlMs: number): RawPullRequestNode[] | null {
  if (ttlMs <= 0 || !existsSync(path)) return null;

  let parsed: CacheFile;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }

  if (parsed.owner !== owner || parsed.repo !== repo) return null;
  const age = Date.now() - Date.parse(parsed.cachedAt);
  if (!Number.isFinite(age) || age > ttlMs) return null;

  return parsed.pullRequests;
}

export function writePullRequestCache(path: string, owner: string, repo: string, pullRequests: RawPullRequestNode[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const payload: CacheFile = { cachedAt: new Date().toISOString(), owner, repo, pullRequests };
  writeFileSync(path, JSON.stringify(payload));
}
