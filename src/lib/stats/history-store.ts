import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bucketRepoHistory } from "./history-buckets";
import type { HistoricalDataset, HistoricalIssue } from "./types";

export interface Meta {
  repos: string[];
  fetchedAt: string;
}

function metaPath(dir: string): string {
  return join(dir, "meta.json");
}

/** No longer written here — recent-commit authors live in the gitignored `.cache/` (see `recent-commits-cache.ts`), not the committed baseline. Only used to clean up the file for a checkout from before that move. */
function legacyRecentCommitsPath(dir: string): string {
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

/** `recentCommitAuthors` is always empty here — it's no longer stored in data/history/ at all (see `recent-commits-cache.ts`); `dataset.ts` fills it in separately before this is used. */
function assembleDataset(dir: string, repos: string[], fetchedAt: string): HistoricalDataset {
  return {
    issues: repos.flatMap((repo) => readRepoIssues(dir, repo)),
    recentCommitAuthors: [],
    fetchedAt,
  };
}

/**
 * data/history/ is the committed source of truth, not a TTL-gated cache (unlike the gitignored
 * `.cache/` used elsewhere) — `dataset.ts` always trusts whatever's here as a baseline and only
 * live-fetches what's missing or changed since `fetchedAt` (see `fetchAndPersistHistoricalDataset`).
 *
 * Returns just `{ repos, fetchedAt }` without reading any bucket files — `dataset.ts` uses this to
 * decide, per repo in STATS_REPOS, whether it already has a baseline (incremental top-up) or needs
 * a full fetch (never seen before). Null if there's no committed data at all yet.
 */
export function readHistoryMeta(dir: string): Meta | null {
  return readJson<Meta>(metaPath(dir));
}

/**
 * Whatever's committed, however old or repo-set-mismatched — only misses when `meta.json` itself
 * is missing/corrupt. Used both as the merge baseline for a live incremental fetch, and as a
 * last-resort fallback when there's no GITHUB_OAUTH_TOKEN to fetch live at all.
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
 * `frozen-<year>.json` instead), whole repo directories for a repo that's no longer in `repos`
 * (e.g. removed from STATS_REPOS), and a leftover `recent-commits.json` from a checkout predating
 * its move to `.cache/`. `dataset.recentCommitAuthors` itself is ignored — not this function's concern.
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

  rmSync(legacyRecentCommitsPath(dir), { force: true });
  writeJson(metaPath(dir), { repos, fetchedAt: dataset.fetchedAt } satisfies Meta);
}
