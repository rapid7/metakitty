import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type RecentCommitAuthor = { repo: string; author: string };

interface CacheFile {
  repos: string[];
  fetchedAt: string;
  recentCommitAuthors: RecentCommitAuthor[];
}

function sameRepoSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((repo, index) => repo === sorted[index]);
}

/**
 * Unlike `data/history/`'s issues/PRs, recent-commit authors are a cheap-to-recompute, bounded
 * 30-day rolling window with no value in being incrementally merged against a committed baseline
 * — wholesale-replacing it is already what every live fetch does. So this lives in the gitignored,
 * TTL-gated `.cache/` instead of being committed.
 */
export function readRecentCommitsCache(path: string, repos: string[], ttlMs: number): RecentCommitAuthor[] | null {
  if (ttlMs <= 0 || !existsSync(path)) return null;

  let parsed: CacheFile;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }

  if (!sameRepoSet(parsed.repos, repos)) return null;
  const age = Date.now() - Date.parse(parsed.fetchedAt);
  if (!Number.isFinite(age) || age > ttlMs) return null;

  return parsed.recentCommitAuthors;
}

export function writeRecentCommitsCache(path: string, repos: string[], recentCommitAuthors: RecentCommitAuthor[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const payload: CacheFile = { repos, fetchedAt: new Date().toISOString(), recentCommitAuthors };
  writeFileSync(path, JSON.stringify(payload));
}
