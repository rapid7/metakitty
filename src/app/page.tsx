import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Dashboard } from "@/components/dashboard";
import { fetchOpenPullRequests, type RawPullRequestNode } from "@/lib/github-client";
import { mapPullRequest } from "@/lib/pull-requests";
import { readPullRequestCache, writePullRequestCache } from "@/lib/pr-cache";
import { enrichWithVulnerabilityRefs } from "@/lib/vuln/enrich";
import type { PullRequest } from "@/lib/types";

const CACHE_DIR = resolve(process.cwd(), ".cache");
const PR_CACHE_PATH = resolve(CACHE_DIR, "github-pull-requests.json");
const DEFAULT_CACHE_TTL_MINUTES = 15;
const DEFAULT_ADVISORY_TTL_DAYS = 7;

async function loadPullRequests(): Promise<PullRequest[]> {
  if (process.env.FIXTURE_DATA === "1") {
    const fixturePath = resolve(process.cwd(), "fixtures/sample-prs.json");
    const rawPullRequests = JSON.parse(readFileSync(fixturePath, "utf8")) as RawPullRequestNode[];
    // Fixture builds stay fully offline: no live GitHub/OSV/NVD/KEV calls, so vulnRefs stays empty.
    return rawPullRequests.map(mapPullRequest);
  }

  const owner = process.env.GITHUB_OWNER?.trim();
  const repo = process.env.GITHUB_REPO?.trim();
  const token = process.env.GITHUB_OAUTH_TOKEN?.trim();
  if (!owner || !repo || !token) {
    throw new Error("GITHUB_OWNER, GITHUB_REPO, and GITHUB_OAUTH_TOKEN must all be set (or pass FIXTURE_DATA=1 to build from fixtures).");
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

async function loadRawPullRequests(owner: string, repo: string, token: string): Promise<RawPullRequestNode[]> {
  const ttlMinutes = Number(process.env.GITHUB_CACHE_TTL_MINUTES ?? DEFAULT_CACHE_TTL_MINUTES);
  const ttlMs = (Number.isFinite(ttlMinutes) ? ttlMinutes : DEFAULT_CACHE_TTL_MINUTES) * 60_000;

  const cached = readPullRequestCache(PR_CACHE_PATH, owner, repo, ttlMs);
  if (cached) {
    console.log(`[pr-cache] Using cached pull requests (<= ${ttlMinutes}m old) from ${PR_CACHE_PATH}`);
    return cached;
  }

  const pullRequests = await fetchOpenPullRequests({ owner, repo, token });
  writePullRequestCache(PR_CACHE_PATH, owner, repo, pullRequests);
  return pullRequests;
}

export default async function Page() {
  const pullRequests = await loadPullRequests();
  const generatedAt = new Date().toISOString();
  return <Dashboard pullRequests={pullRequests} generatedAt={generatedAt} />;
}
