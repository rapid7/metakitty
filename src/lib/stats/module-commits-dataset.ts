import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getLandedModuleCommits, type LandedModuleCommit } from "./commits-modules";
import { fetchModuleCommitsSince, type RawModuleCommit } from "./module-commits-client";

const LOOKBACK_DAYS = 30;

function loadFixtureModuleCommits(): RawModuleCommit[] {
  const fixturePath = resolve(process.cwd(), "fixtures/sample-module-commits.json");
  return JSON.parse(readFileSync(fixturePath, "utf8")) as RawModuleCommit[];
}

let inFlight: Promise<LandedModuleCommit[]> | null = null;

export function loadLandedModuleCommits(): Promise<LandedModuleCommit[]> {
  if (!inFlight) {
    inFlight = (async () => {
      if (process.env.FIXTURE_DATA === "1") {
        return getLandedModuleCommits(loadFixtureModuleCommits());
      }
      const token = process.env.GITHUB_OAUTH_TOKEN?.trim();
      if (!token) {
        throw new Error("GITHUB_OAUTH_TOKEN must be set (or pass FIXTURE_DATA=1 to build from fixtures).");
      }
      console.log("[stats] Fetching recently landed module commits...");
      const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
      const commits = await fetchModuleCommitsSince(token, sinceIso);
      console.log(`[stats] Fetched ${commits.length} module commits in the last ${LOOKBACK_DAYS} days.`);
      return getLandedModuleCommits(commits);
    })();
    inFlight.catch(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
