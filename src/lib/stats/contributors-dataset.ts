import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInBatches } from "../async";
import { resolveGitHubToken } from "../github-token";
import { CONTRIBUTOR_ALIASES } from "./contributor-aliases";
import { aggregateContributors, countLogins, topContributorInfos, type ContributorInfo } from "./contributors";
import { fetchRepoContributorsAllTime, fetchUserProfile, type GitHubUserProfile } from "./contributors-client";
import { readContributorsCache, writeContributorsCache } from "./contributors-cache";
import { fetchRepoRecentCommits } from "./github-history-client";
import { STATS_REPOS } from "./repos";

const CACHE_DIR = resolve(process.cwd(), ".cache");
const CONTRIBUTORS_CACHE_PATH = resolve(CACHE_DIR, "github-contributors.json");
const DEFAULT_CACHE_TTL_MINUTES = 1440;
const MONTH_LOOKBACK_DAYS = 30;
const YEAR_LOOKBACK_DAYS = 365;

export interface ContributorsDataset {
  all: ContributorInfo[];
  month: ContributorInfo[];
  year: ContributorInfo[];
  fetchedAt: string;
}

interface ContributorsFixture {
  all: Array<{ login: string; contributions: number }>;
  month: Array<{ login: string; contributions: number }>;
  year: Array<{ login: string; contributions: number }>;
  profiles: Record<string, GitHubUserProfile>;
}

function buildList(entries: Array<{ login: string; contributions: number }>, profiles: Map<string, GitHubUserProfile>): ContributorInfo[] {
  return topContributorInfos(aggregateContributors(entries, CONTRIBUTOR_ALIASES), profiles);
}

function loadFixtureContributors(): ContributorsDataset {
  const fixturePath = resolve(process.cwd(), "fixtures/sample-contributors.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as ContributorsFixture;
  const profiles = new Map(Object.entries(fixture.profiles));
  return {
    all: buildList(fixture.all, profiles),
    month: buildList(fixture.month, profiles),
    year: buildList(fixture.year, profiles),
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchLiveContributors(): Promise<ContributorsDataset> {
  const token = resolveGitHubToken();
  if (!token) {
    throw new Error("GITHUB_OAUTH_TOKEN or GITHUB_BASIC_AUTH must be set (or pass FIXTURE_DATA=1 to build from fixtures).");
  }

  const ttlMinutes = Number(process.env.GITHUB_HISTORY_CACHE_TTL_MINUTES ?? DEFAULT_CACHE_TTL_MINUTES);
  const ttlMs = (Number.isFinite(ttlMinutes) ? ttlMinutes : DEFAULT_CACHE_TTL_MINUTES) * 60_000;

  const cached = readContributorsCache(CONTRIBUTORS_CACHE_PATH, STATS_REPOS, ttlMs);
  if (cached) return cached;

  const monthSinceIso = new Date(Date.now() - MONTH_LOOKBACK_DAYS * 86_400_000).toISOString();
  const yearSinceIso = new Date(Date.now() - YEAR_LOOKBACK_DAYS * 86_400_000).toISOString();

  const allCounts: Array<{ login: string; contributions: number }> = [];
  const monthLogins: string[] = [];
  const yearLogins: string[] = [];
  const totalRepos = STATS_REPOS.length;
  let completedRepos = 0;

  console.log(`[stats] Fetching contributor history for ${totalRepos} repos...`);

  await runInBatches(STATS_REPOS, 4, async (repo) => {
    try {
      const [contributors, monthAuthors, yearAuthors] = await Promise.all([
        fetchRepoContributorsAllTime(token, repo),
        fetchRepoRecentCommits(token, repo, monthSinceIso),
        fetchRepoRecentCommits(token, repo, yearSinceIso),
      ]);
      for (const contributor of contributors) {
        if (contributor.login) allCounts.push({ login: contributor.login, contributions: contributor.contributions });
      }
      monthLogins.push(...monthAuthors);
      yearLogins.push(...yearAuthors);
      completedRepos++;
      console.log(`[stats] (${completedRepos}/${totalRepos}) contributors for ${repo}: ${contributors.length} all-time`);
    } catch (error) {
      completedRepos++;
      console.warn(`[stats] (${completedRepos}/${totalRepos}) Skipping contributors for ${repo}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  const monthCounts = countLogins(monthLogins);
  const yearCounts = countLogins(yearLogins);

  const allAgg = aggregateContributors(allCounts, CONTRIBUTOR_ALIASES);
  const monthAgg = aggregateContributors(monthCounts, CONTRIBUTOR_ALIASES);
  const yearAgg = aggregateContributors(yearCounts, CONTRIBUTOR_ALIASES);

  const uniqueLogins = [...new Set([...allAgg.keys(), ...monthAgg.keys(), ...yearAgg.keys()])];
  const profiles = new Map<string, GitHubUserProfile>();
  let completedProfiles = 0;
  console.log(`[stats] Resolving ${uniqueLogins.length} contributor profiles...`);
  await runInBatches(uniqueLogins, 5, async (login) => {
    const profile = await fetchUserProfile(token, login);
    if (profile) profiles.set(login, profile);
    completedProfiles++;
    if (completedProfiles % 10 === 0 || completedProfiles === uniqueLogins.length) {
      console.log(`[stats] (${completedProfiles}/${uniqueLogins.length}) profiles resolved`);
    }
  });

  const dataset: ContributorsDataset = {
    all: topContributorInfos(allAgg, profiles),
    month: topContributorInfos(monthAgg, profiles),
    year: topContributorInfos(yearAgg, profiles),
    fetchedAt: new Date().toISOString(),
  };
  writeContributorsCache(CONTRIBUTORS_CACHE_PATH, STATS_REPOS, dataset);
  return dataset;
}

let inFlight: Promise<ContributorsDataset> | null = null;

/** Loads all-time/month/year top-contributor leaderboards, shared (via an in-flight singleton) across the 3 contributors_*.json route handlers. */
export function loadContributorsDataset(): Promise<ContributorsDataset> {
  if (!inFlight) {
    inFlight = process.env.FIXTURE_DATA === "1" ? Promise.resolve(loadFixtureContributors()) : fetchLiveContributors();
    inFlight.catch(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
