import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAllRepoHistories, type TaggedIssueNode, type TaggedPullRequestNode } from "./github-history-client";
import { mapHistoricalIssue, mapHistoricalPullRequest } from "./map-historical-issue";
import { readHistoryCache, writeHistoryCache } from "./history-cache";
import { PRIMARY_REPO, STATS_OWNER, STATS_REPOS } from "./repos";
import type { HistoricalDataset } from "./types";

const CACHE_DIR = resolve(process.cwd(), ".cache");
const HISTORY_CACHE_PATH = resolve(CACHE_DIR, "github-historical-issues.json");
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

async function fetchLiveDataset(): Promise<HistoricalDataset> {
  const token = process.env.GITHUB_OAUTH_TOKEN?.trim();
  if (!token) {
    throw new Error("GITHUB_OAUTH_TOKEN must be set (or pass FIXTURE_DATA=1 to build from fixtures).");
  }

  const ttlMinutes = Number(process.env.GITHUB_HISTORY_CACHE_TTL_MINUTES ?? DEFAULT_CACHE_TTL_MINUTES);
  const ttlMs = (Number.isFinite(ttlMinutes) ? ttlMinutes : DEFAULT_CACHE_TTL_MINUTES) * 60_000;

  const cached = readHistoryCache(HISTORY_CACHE_PATH, STATS_REPOS, ttlMs);
  if (cached) {
    console.log(`[stats-cache] Using cached historical dataset (<= ${ttlMinutes}m old) from ${HISTORY_CACHE_PATH}`);
    return cached;
  }

  console.log(`[stats-cache] No fresh cache at ${HISTORY_CACHE_PATH}; fetching live from GitHub (this can take a while across ${STATS_REPOS.length} repos)...`);
  const commitsSinceIso = new Date(Date.now() - COMMITS_LOOKBACK_DAYS * 86_400_000).toISOString();
  const { issues, pullRequests, recentCommitAuthors } = await fetchAllRepoHistories(token, STATS_REPOS, { commitsSinceIso });

  // A per-repo fetch failure (e.g. a renamed/archived repo, or a sustained outage that outlasted
  // retries) is normally just skipped with a warning — but losing the flagship repo entirely would
  // silently produce a near-empty, misleading dataset for every Dashboard page. Refuse to trust (or
  // cache) that rather than serving it for up to 24h.
  const primaryRepoCount = issues.filter((node) => node.project === PRIMARY_REPO).length + pullRequests.filter((node) => node.project === PRIMARY_REPO).length;
  if (primaryRepoCount === 0) {
    throw new Error(`[stats] Fetched zero issues/PRs for the primary repo (${STATS_OWNER}/${PRIMARY_REPO}) — likely a transient GitHub API failure that outlasted retries. Refusing to build or cache a near-empty historical dataset; re-run the build.`);
  }

  const dataset: HistoricalDataset = {
    issues: [...issues.map(mapHistoricalIssue), ...pullRequests.map(mapHistoricalPullRequest)],
    recentCommitAuthors,
    fetchedAt: new Date().toISOString(),
  };

  writeHistoryCache(HISTORY_CACHE_PATH, STATS_REPOS, dataset);
  console.log(`[stats-cache] Wrote historical dataset to ${HISTORY_CACHE_PATH} (${dataset.issues.length} issues/PRs total).`);
  return dataset;
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
