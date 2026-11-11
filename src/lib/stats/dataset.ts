import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAllRepoHistories, type TaggedIssueNode, type TaggedPullRequestNode } from "./github-history-client";
import { mapHistoricalIssue, mapHistoricalPullRequest } from "./map-historical-issue";
import { readHistoryStore, readFreshHistoryStore, writeHistoryStore } from "./history-store";
import { PRIMARY_REPO, STATS_OWNER, STATS_REPOS } from "./repos";
import type { HistoricalDataset } from "./types";
import { resolveGitHubToken } from "../github-token";

// A committed directory serves as both the TTL-gated cache for an active build session and the
// baseline a developer chooses to check in — fetching the full history is expensive (thousands of
// paginated requests across ~30 repos), unlike module counts' single cheap curl, so unlike
// module-counts-dataset.ts (which keeps its cache in the gitignored `.cache/`) this one is worth
// persisting as a committed fallback rather than re-paying that cost on every fresh checkout. It's
// split per-repo and per-mutability-bucket (see history-buckets.ts) rather than one blob, so a
// refresh's git diff is reviewable and a quiet repo's files simply never change.
const HISTORY_STORE_DIR = resolve(process.cwd(), "data/history");
const DEFAULT_CACHE_TTL_MINUTES = 1440;
const COMMITS_LOOKBACK_DAYS = 30;

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

/**
 * Fetches the full multi-repo history live from GitHub and persists it to data/history/ — an
 * ordinary `npm run build` keeps data/history/ current on its own whenever it does a live fetch,
 * no separate step required.
 */
async function fetchAndPersistHistoricalDataset(token: string): Promise<HistoricalDataset> {
  console.log(`[stats] Fetching live from GitHub (this can take a while across ${STATS_REPOS.length} repos)...`);
  const commitsSinceIso = new Date(Date.now() - COMMITS_LOOKBACK_DAYS * 86_400_000).toISOString();
  const { issues, pullRequests, recentCommitAuthors } = await fetchAllRepoHistories(token, STATS_REPOS, { commitsSinceIso });

  // A per-repo fetch failure (e.g. a renamed/archived repo, or a sustained outage that outlasted
  // retries) is normally just skipped with a warning — but losing the flagship repo entirely would
  // silently produce a near-empty, misleading dataset for every Dashboard page. Refuse to trust (or
  // persist) that rather than serving/committing it.
  const primaryRepoCount = issues.filter((node) => node.project === PRIMARY_REPO).length + pullRequests.filter((node) => node.project === PRIMARY_REPO).length;
  if (primaryRepoCount === 0) {
    throw new Error(`[stats] Fetched zero issues/PRs for the primary repo (${STATS_OWNER}/${PRIMARY_REPO}) — likely a transient GitHub API failure that outlasted retries. Refusing to persist a near-empty historical dataset; re-run.`);
  }

  const dataset: HistoricalDataset = {
    issues: [...issues.map(mapHistoricalIssue), ...pullRequests.map(mapHistoricalPullRequest)],
    recentCommitAuthors,
    fetchedAt: new Date().toISOString(),
  };

  writeHistoryStore(HISTORY_STORE_DIR, STATS_REPOS, dataset);
  console.log(`[stats-cache] Wrote historical dataset to ${HISTORY_STORE_DIR} (${dataset.issues.length} issues/PRs total).`);
  return dataset;
}

async function fetchLiveDataset(): Promise<HistoricalDataset> {
  const ttlMinutes = Number(process.env.GITHUB_HISTORY_CACHE_TTL_MINUTES ?? DEFAULT_CACHE_TTL_MINUTES);
  const ttlMs = (Number.isFinite(ttlMinutes) ? ttlMinutes : DEFAULT_CACHE_TTL_MINUTES) * 60_000;

  const fresh = readFreshHistoryStore(HISTORY_STORE_DIR, STATS_REPOS, ttlMs);
  if (fresh) {
    console.log(`[stats-cache] Using ${HISTORY_STORE_DIR} (<= ${ttlMinutes}m old, matching repo set)`);
    return fresh;
  }

  const token = resolveGitHubToken();
  if (!token) {
    const committed = readHistoryStore(HISTORY_STORE_DIR);
    if (committed) {
      console.warn(
        `[stats] No GitHub token (GITHUB_OAUTH_TOKEN/GITHUB_BASIC_AUTH) and ${HISTORY_STORE_DIR} isn't fresh enough (or STATS_REPOS changed); falling back to it anyway (fetched ${committed.fetchedAt}, may be stale). Set a token to refresh it.`
      );
      return committed;
    }
    throw new Error(
      "GITHUB_OAUTH_TOKEN or GITHUB_BASIC_AUTH must be set (or pass FIXTURE_DATA=1 to build from fixtures). Running a build with a token at least once also commits a data/history/ snapshot other token-less builds can fall back to."
    );
  }

  return fetchAndPersistHistoricalDataset(token);
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
