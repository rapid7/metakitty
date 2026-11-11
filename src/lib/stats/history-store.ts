import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bucketRepoHistory } from "./history-buckets";
import type { HistoricalDataset, HistoricalIssue } from "./types";

interface Meta {
  repos: string[];
  fetchedAt: string;
}

function sameRepoSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((repo, index) => repo === sorted[index]);
}

function metaPath(dir: string): string {
  return join(dir, "meta.json");
}

function recentCommitsPath(dir: string): string {
  return join(dir, "recent-commits.json");
}

function repoDir(dir: string, repo: string): string {
  return join(dir, repo);
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Pretty-printed (2-space indent + trailing newline), unlike a minified `JSON.stringify` — these files are committed, so a one-field change should produce a small, reviewable git diff instead of a single rewritten line. */
function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function readRepoIssues(dir: string, repo: string): HistoricalIssue[] {
  const dirPath = repoDir(dir, repo);
  if (!existsSync(dirPath)) return [];
  const issues: HistoricalIssue[] = [];
  for (const file of readdirSync(dirPath)) {
    if (!file.endsWith(".json")) continue;
    const parsed = readJson<HistoricalIssue[]>(join(dirPath, file));
    if (parsed) issues.push(...parsed);
  }
  return issues;
}

function assembleDataset(dir: string, repos: string[], fetchedAt: string): HistoricalDataset {
  return {
    issues: repos.flatMap((repo) => readRepoIssues(dir, repo)),
    recentCommitAuthors: readJson(recentCommitsPath(dir)) ?? [],
    fetchedAt,
  };
}

/**
 * data/history/ is both the TTL-gated cache for an active build session and the committed
 * baseline a developer chooses to check in — the same directory serves both roles, since every
 * live fetch writes it (see `fetchAndPersistHistoricalDataset` in `dataset.ts`).
 *
 * Strict read: only usable as a live-fetch substitute if `meta.json` is within `ttlMs` and its
 * repo set matches `repos` (e.g. STATS_REPOS wasn't edited since). Returns null on any miss.
 */
export function readFreshHistoryStore(dir: string, repos: string[], ttlMs: number): HistoricalDataset | null {
  if (ttlMs <= 0) return null;

  const meta = readJson<Meta>(metaPath(dir));
  if (!meta) return null;
  if (!sameRepoSet(meta.repos, repos)) return null;

  const age = Date.now() - Date.parse(meta.fetchedAt);
  if (!Number.isFinite(age) || age > ttlMs) return null;

  return assembleDataset(dir, meta.repos, meta.fetchedAt);
}

/**
 * Lax read: whatever's committed, however stale or repo-set-mismatched, as a last resort when
 * there's no GITHUB_OAUTH_TOKEN to fetch live. Unlike {@link readFreshHistoryStore}, only misses
 * when `meta.json` itself is missing/corrupt — age and repo-set are irrelevant here, since
 * "whatever's committed" beats refusing to render at all.
 */
export function readHistoryStore(dir: string): HistoricalDataset | null {
  const meta = readJson<Meta>(metaPath(dir));
  if (!meta) return null;
  return assembleDataset(dir, meta.repos, meta.fetchedAt);
}

/**
 * Writes `dataset` into the per-repo, per-mutability-bucket layout described in
 * `history-buckets.ts`, overwriting every bucket file from this fetch's full snapshot. Also
 * deletes anything no longer produced: a bucket file emptied out (e.g. a `hot-<year>.json` whose
 * last lingering open item finally closed, so that year is now fully captured by
 * `frozen-<year>.json` instead), and whole repo directories for a repo that's no longer in
 * `repos` (e.g. removed from STATS_REPOS).
 */
export function writeHistoryStore(dir: string, repos: string[], dataset: HistoricalDataset, now: Date = new Date()): void {
  mkdirSync(dir, { recursive: true });

  const previousMeta = readJson<Meta>(metaPath(dir));
  const staleRepos = previousMeta?.repos.filter((repo) => !repos.includes(repo)) ?? [];
  for (const repo of staleRepos) {
    rmSync(repoDir(dir, repo), { recursive: true, force: true });
  }

  const issuesByRepo = new Map<string, HistoricalIssue[]>();
  for (const issue of dataset.issues) {
    const list = issuesByRepo.get(issue.project);
    if (list) list.push(issue);
    else issuesByRepo.set(issue.project, [issue]);
  }

  for (const repo of repos) {
    const dirPath = repoDir(dir, repo);
    mkdirSync(dirPath, { recursive: true });

    const { frozen, hot } = bucketRepoHistory(issuesByRepo.get(repo) ?? [], now);
    const wanted = new Set<string>();
    for (const [year, issues] of frozen) {
      const name = `frozen-${year}.json`;
      writeJson(join(dirPath, name), issues);
      wanted.add(name);
    }
    for (const [year, issues] of hot) {
      const name = `hot-${year}.json`;
      writeJson(join(dirPath, name), issues);
      wanted.add(name);
    }

    for (const file of readdirSync(dirPath)) {
      if (file.endsWith(".json") && !wanted.has(file)) {
        rmSync(join(dirPath, file));
      }
    }
  }

  writeJson(recentCommitsPath(dir), dataset.recentCommitAuthors);
  writeJson(metaPath(dir), { repos, fetchedAt: dataset.fetchedAt } satisfies Meta);
}
