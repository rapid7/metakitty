import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ContributorsDataset } from "./contributors-dataset";

interface CacheFile {
  repos: string[];
  dataset: ContributorsDataset;
}

function sameRepoSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((repo, index) => repo === sorted[index]);
}

export function readContributorsCache(path: string, repos: string[], ttlMs: number): ContributorsDataset | null {
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

export function writeContributorsCache(path: string, repos: string[], dataset: ContributorsDataset): void {
  mkdirSync(dirname(path), { recursive: true });
  const payload: CacheFile = { repos, dataset };
  writeFileSync(path, JSON.stringify(payload));
}
