import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  fetchAllRepoHistories,
  fetchAllRepoHistoriesSince,
  fetchAllRepoRecentCommits,
  type RepoHistoriesResult,
  type TaggedIssueNode,
  type TaggedPullRequestNode,
} from "./github-history-client";
import { mapHistoricalIssue, mapHistoricalPullRequest } from "./map-historical-issue";
import { readHistoryStore, readHistoryMeta, writeHistoryStore } from "./history-store";
import { readRecentCommitsCache, writeRecentCommitsCache, type RecentCommitAuthor } from "./recent-commits-cache";
import { PRIMARY_REPO, STATS_OWNER, STATS_REPOS } from "./repos";
import type { HistoricalDataset, HistoricalIssue } from "./types";
import { resolveGitHubToken } from "../github-token";
import { withFileLock } from "./file-lock";

// data/history/ is the committed source of truth, not a TTL-gated cache (unlike the gitignored
// `.cache/` used elsewhere) — it's always trusted as a baseline, and a live fetch only tops it up:
// a full fetch for any repo it's never seen (new to STATS_REPOS), an incremental `since`-filtered
// fetch for everything else. Fetching the FULL history live is expensive (thousands of paginated
// requests across ~30 repos), so this keeps every ordinary build cheap after the first. It's split
// per-repo and per-mutability-bucket (see history-buckets.ts) rather than one blob, so a refresh's
// git diff is reviewable and a quiet repo's files simply never change.
const HISTORY_STORE_DIR = resolve(process.cwd(), "data/history");
// Recent-commit authors are a cheap, bounded 30-day rolling window — unlike issues/PRs, there's no
// value in a committed baseline (it's wholesale-replaced every fetch anyway), so this is a plain
// TTL-gated .cache/ entry instead, same as the rest of the app's short-lived GitHub caches.
const RECENT_COMMITS_CACHE_PATH = resolve(process.cwd(), ".cache", "github-recent-commits.json");
const DEFAULT_RECENT_COMMITS_CACHE_TTL_MINUTES = 15;
const COMMITS_LOOKBACK_DAYS = 30;
const EMPTY_RESULT: RepoHistoriesResult = { issues: [], pullRequests: [] };

interface StatsFixture {
  issues: TaggedIssueNode[];
  pullRequests: TaggedPullRequestNode[];
  recentCommits: Array<{ repo: string; author: string }>;
}

function loadFixtureDataset(): HistoricalDataset {
  const fixturePath = resolve(process.cwd(), "fixtures/sample-stats.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as StatsFixture;
  return {
    issues: [...fixture.issues.map(mapHistoricalIssue), ...fixture.pullRequests.map(mapHistoricalPullRequest)],
    recentCommitAuthors: fixture.recentCommits,
    fetchedAt: new Date().toISOString(),
  };
}

/** Replaces/adds every issue in `updates` into `baseline`, keyed by (repo, number) — the two share one numbering sequence per GitHub repo, so this is unambiguous and idempotent to re-run. */
function mergeIssues(baseline: HistoricalIssue[], updates: HistoricalIssue[]): HistoricalIssue[] {
  const byKey = new Map(baseline.map((issue) => [`${issue.project}#${issue.number}`, issue]));
  for (const issue of updates) byKey.set(`${issue.project}#${issue.number}`, issue);
  return [...byKey.values()];
}

function toHistoricalIssues(result: RepoHistoriesResult): HistoricalIssue[] {
  return [...result.issues.map(mapHistoricalIssue), ...result.pullRequests.map(mapHistoricalPullRequest)];
}

/**
 * Recent-commit authors live in the gitignored `.cache/`, not the committed `data/history/` —
 * unlike issues/PRs, this is a cheap, bounded 30-day rolling window that's wholesale-replaced on
 * every live fetch anyway, so a TTL-gated cache (same pattern as the rest of the app's short-lived
 * GitHub caches) is all it needs, no incremental-merge baseline. Locked for the same reason as
 * `fetchLiveDataset`: `next build`'s static export can run multiple page/route bundles
 * concurrently, each with its own in-memory module state.
 */
async function fetchRecentCommitAuthors(token: string): Promise<RecentCommitAuthor[]> {
  return withFileLock(resolve(process.cwd(), ".cache", ".recent-commits.lock"), async () => {
    const ttlMinutes = Number(process.env.GITHUB_CACHE_TTL_MINUTES ?? DEFAULT_RECENT_COMMITS_CACHE_TTL_MINUTES);
    const ttlMs = (Number.isFinite(ttlMinutes) ? ttlMinutes : DEFAULT_RECENT_COMMITS_CACHE_TTL_MINUTES) * 60_000;

    const cached = readRecentCommitsCache(RECENT_COMMITS_CACHE_PATH, STATS_REPOS, ttlMs);
    if (cached) return cached;

    const commitsSinceIso = new Date(Date.now() - COMMITS_LOOKBACK_DAYS * 86_400_000).toISOString();
    const recentCommitAuthors = await fetchAllRepoRecentCommits(token, STATS_REPOS, commitsSinceIso);
    writeRecentCommitsCache(RECENT_COMMITS_CACHE_PATH, STATS_REPOS, recentCommitAuthors);
    return recentCommitAuthors;
  });
}

/**
 * Tops up data/history/ live from GitHub and persists the merged result — a full fetch for any
 * repo with no baseline yet, an incremental `since`-filtered fetch for the rest, merged over
 * `baseline`'s own issues. An ordinary `npm run build` keeps data/history/ current on its own
 * whenever it does a live fetch, no separate step required.
 */
async function fetchAndPersistHistoricalDataset(token: string, baseline: HistoricalDataset | null, baselineRepos: string[]): Promise<HistoricalDataset> {
  console.log(`[stats] Fetching live from GitHub (this can take a while across ${STATS_REPOS.length} repos)...`);

  const knownRepos = new Set(baselineRepos);
  const newRepos = STATS_REPOS.filter((repo) => !knownRepos.has(repo));
  const topUpRepos = STATS_REPOS.filter((repo) => knownRepos.has(repo));

  // Sequential, not concurrent: these are already expensive, highly-concurrent live fetches
  // against the same GitHub token — running them at the same time just competes for the same rate
  // limit. `newRepos` is normally empty (STATS_REPOS rarely changes), so this is the common case's
  // only issue/PR fetch anyway.
  const newResult = newRepos.length > 0 ? await fetchAllRepoHistories(token, newRepos) : EMPTY_RESULT;
  const topUpResult = topUpRepos.length > 0 && baseline ? await fetchAllRepoHistoriesSince(token, topUpRepos, baseline.fetchedAt) : EMPTY_RESULT;
  const recentCommitAuthors = await fetchRecentCommitAuthors(token);

  const mergedIssues = mergeIssues(baseline?.issues ?? [], [...toHistoricalIssues(newResult), ...toHistoricalIssues(topUpResult)]);

  // A per-repo fetch failure (e.g. a renamed/archived repo, or a sustained outage that outlasted
  // retries) is normally just skipped with a warning — but losing the flagship repo entirely would
  // silently produce a near-empty, misleading dataset for every Dashboard page. Refuse to trust (or
  // persist) that rather than serving/committing it. Scoped to the *merged* count, not just this
  // fetch's delta — an incremental top-up legitimately returning nothing (nothing changed since
  // last time) is normal, not a failure.
  const primaryRepoCount = mergedIssues.filter((issue) => issue.project === PRIMARY_REPO).length;
  if (primaryRepoCount === 0) {
    throw new Error(`[stats] Fetched zero issues/PRs for the primary repo (${STATS_OWNER}/${PRIMARY_REPO}) — likely a transient GitHub API failure that outlasted retries. Refusing to persist a near-empty historical dataset; re-run.`);
  }

  const dataset: HistoricalDataset = {
    issues: mergedIssues,
    recentCommitAuthors,
    fetchedAt: new Date().toISOString(),
  };

  writeHistoryStore(HISTORY_STORE_DIR, STATS_REPOS, dataset);
  console.log(`[stats-cache] Wrote historical dataset to ${HISTORY_STORE_DIR} (${dataset.issues.length} issues/PRs total).`);
  return dataset;
}

async function fetchLiveDataset(): Promise<HistoricalDataset> {
  return withFileLock(resolve(HISTORY_STORE_DIR, ".lock"), async () => {
    const meta = readHistoryMeta(HISTORY_STORE_DIR);

    const token = resolveGitHubToken();
    if (!token) {
      const committed = readHistoryStore(HISTORY_STORE_DIR);
      if (committed) {
        // Lax read, ignoring the TTL entirely (unlike fetchRecentCommitAuthors's live path) —
        // there's no live fetch to fall back from here, so whatever's cached (however old) beats
        // an empty top-committers list.
        const recentCommitAuthors = readRecentCommitsCache(RECENT_COMMITS_CACHE_PATH, STATS_REPOS, Number.POSITIVE_INFINITY) ?? [];
        console.warn(
          `[stats] No GitHub token (GITHUB_OAUTH_TOKEN/GITHUB_BASIC_AUTH); using ${HISTORY_STORE_DIR} as-is (fetched ${committed.fetchedAt}, may be stale). Set a token to refresh it.`
        );
        return { ...committed, recentCommitAuthors };
      }
      throw new Error(
        "GITHUB_OAUTH_TOKEN or GITHUB_BASIC_AUTH must be set (or pass FIXTURE_DATA=1 to build from fixtures). Running a build with a token at least once also commits a data/history/ snapshot other token-less builds can fall back to."
      );
    }

    const baseline = meta ? readHistoryStore(HISTORY_STORE_DIR) : null;
    return fetchAndPersistHistoricalDataset(token, baseline, meta?.repos ?? []);
  });
}

let inFlight: Promise<HistoricalDataset> | null = null;

/** Loads the full multi-repo issue/PR/commit-author history, shared (via an in-flight singleton) across every Dashboard page rendered in this process. */
export function loadHistoricalDataset(): Promise<HistoricalDataset> {
  if (!inFlight) {
    inFlight = process.env.FIXTURE_DATA === "1" ? Promise.resolve(loadFixtureDataset()) : fetchLiveDataset();
    inFlight.catch(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
