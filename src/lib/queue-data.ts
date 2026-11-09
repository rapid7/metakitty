import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchOpenPullRequestCount, fetchOpenPullRequests, type RawPullRequestNode } from "./github-client";
import { mapPullRequest } from "./pull-requests";
import { readPullRequestCache, writePullRequestCache } from "./pr-cache";
import { readPullRequestCountCache, writePullRequestCountCache } from "./pr-count-cache";
import { enrichWithVulnerabilityRefs } from "./vuln/enrich";
import { runInBatches } from "./async";
import type { PullRequest } from "./types";

const CACHE_DIR = resolve(process.cwd(), ".cache");
const DEFAULT_CACHE_TTL_MINUTES = 15;
const DEFAULT_ADVISORY_TTL_DAYS = 7;

/**
 * Loads one repo's open PR queue. Fully offline when FIXTURE_DATA=1: the bundled fixture always
 * represents metasploit-framework, so every repo gets that same fixture content (fine for the
 * single-repo build-smoke-test build, which only ever requests the primary repo).
 */
export async function loadPullRequestsForRepo(owner: string, repo: string): Promise<PullRequest[]> {
  if (process.env.FIXTURE_DATA === "1") {
    const fixturePath = resolve(process.cwd(), "fixtures/sample-prs.json");
    const rawPullRequests = JSON.parse(readFileSync(fixturePath, "utf8")) as RawPullRequestNode[];
    // Fixture builds stay fully offline: no live GitHub/OSV/NVD/KEV calls, so vulnRefs stays empty.
    return rawPullRequests.map(mapPullRequest);
  }

  const token = process.env.GITHUB_OAUTH_TOKEN?.trim();
  if (!token) {
    throw new Error("GITHUB_OAUTH_TOKEN must be set (or pass FIXTURE_DATA=1 to build from fixtures).");
  }

  const rawPullRequests = await loadRawPullRequests(owner, repo, token);
  const pullRequests = rawPullRequests.map(mapPullRequest);
  const rawByNumber = new Map(rawPullRequests.map((raw) => [raw.number, raw]));

  const advisoryTtlDays = Number(process.env.ADVISORY_CACHE_TTL_DAYS ?? DEFAULT_ADVISORY_TTL_DAYS);
  const advisoryTtlMs = (Number.isFinite(advisoryTtlDays) ? advisoryTtlDays : DEFAULT_ADVISORY_TTL_DAYS) * 86_400_000;

  return enrichWithVulnerabilityRefs(pullRequests, rawByNumber, {
    github: { owner, repo, token },
    cacheDir: CACHE_DIR,
    advisoryTtlMs,
    nvdApiKey: process.env.NVD_API_KEY?.trim() || undefined,
  });
}

/**
 * Open PR count per repo, for the repo switcher. Fully offline when FIXTURE_DATA=1: every repo
 * reports the same fixture's PR count, mirroring loadPullRequestsForRepo's fixture behavior.
 */
export async function loadOpenPullRequestCounts(owner: string, repos: string[]): Promise<Record<string, number>> {
  if (process.env.FIXTURE_DATA === "1") {
    const fixturePath = resolve(process.cwd(), "fixtures/sample-prs.json");
    const rawPullRequests = JSON.parse(readFileSync(fixturePath, "utf8")) as RawPullRequestNode[];
    return Object.fromEntries(repos.map((repo) => [repo, rawPullRequests.length]));
  }

  const token = process.env.GITHUB_OAUTH_TOKEN?.trim();
  if (!token) {
    throw new Error("GITHUB_OAUTH_TOKEN must be set (or pass FIXTURE_DATA=1 to build from fixtures).");
  }

  const ttlMinutes = Number(process.env.GITHUB_CACHE_TTL_MINUTES ?? DEFAULT_CACHE_TTL_MINUTES);
  const ttlMs = (Number.isFinite(ttlMinutes) ? ttlMinutes : DEFAULT_CACHE_TTL_MINUTES) * 60_000;
  const cachePath = resolve(CACHE_DIR, "github-pr-counts.json");

  const cached = readPullRequestCountCache(cachePath, owner, repos, ttlMs);
  if (cached) {
    console.log(`[pr-count-cache] Using cached PR counts (<= ${ttlMinutes}m old) from ${cachePath}`);
    return cached;
  }

  const counts: Record<string, number> = {};
  await runInBatches(repos, 4, async (repo) => {
    try {
      counts[repo] = await fetchOpenPullRequestCount({ owner, repo, token });
    } catch (error) {
      // Same per-repo tolerance as loadRawPullRequests below: a renamed/archived/rate-limited repo
      // shouldn't take down the whole switcher.
      console.warn(`[queue] Skipping PR count for ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`);
      counts[repo] = 0;
    }
  });

  writePullRequestCountCache(cachePath, owner, repos, counts);
  return counts;
}

async function loadRawPullRequests(owner: string, repo: string, token: string): Promise<RawPullRequestNode[]> {
  const ttlMinutes = Number(process.env.GITHUB_CACHE_TTL_MINUTES ?? DEFAULT_CACHE_TTL_MINUTES);
  const ttlMs = (Number.isFinite(ttlMinutes) ? ttlMinutes : DEFAULT_CACHE_TTL_MINUTES) * 60_000;
  // One cache file per repo — the shared cache file this replaced only ever held a single
  // owner/repo's worth of PRs, so building N repos in the same `next build` would otherwise
  // overwrite it on every repo and never hit a warm cache.
  const cachePath = resolve(CACHE_DIR, `github-pull-requests-${repo}.json`);

  const cached = readPullRequestCache(cachePath, owner, repo, ttlMs);
  if (cached) {
    console.log(`[pr-cache] Using cached pull requests (<= ${ttlMinutes}m old) from ${cachePath}`);
    return cached;
  }

  try {
    const pullRequests = await fetchOpenPullRequests({ owner, repo, token });
    writePullRequestCache(cachePath, owner, repo, pullRequests);
    return pullRequests;
  } catch (error) {
    // Mirrors fetchAllRepoHistories' tolerance (src/lib/stats/github-history-client.ts): this repo
    // list is shared with the Dashboard's stats section and includes entries that may since have
    // been renamed/archived/deleted, or individually rate-limited. One repo failing shouldn't fail
    // the whole static export.
    console.warn(`[queue] Skipping ${owner}/${repo}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
