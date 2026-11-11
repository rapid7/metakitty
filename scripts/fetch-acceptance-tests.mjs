#!/usr/bin/env node
// Downloads the latest successful Acceptance workflow run's `final-report-*` artifact (an Allure
// report) and extracts it into public/acceptance-tests/, so a subsequent `next build`'s static
// export copies it straight into out/. Run explicitly via `npm run fetch:acceptance-tests` before
// `npm run build` — not wired in as a build/prebuild hook, so it only runs when asked to.

import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import JSZip from "jszip";

const OWNER = "rapid7";
const REPO = "metasploit-framework";
const GITHUB_API_BASE = "https://api.github.com";
const OUTPUT_DIR = join(process.cwd(), "public", "acceptance-tests");
const MAX_RUN_LIST_PAGES = 5;

function loadEnvFile() {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file — fine in CI, where the token is already set directly.
  }
}

/** Mirrors src/lib/github-token.ts; duplicated since this script runs via plain `node`, outside Next's TypeScript bundler. */
function resolveGitHubToken() {
  const direct = process.env.GITHUB_OAUTH_TOKEN?.trim();
  if (direct) return direct;

  const basicAuth = process.env.GITHUB_BASIC_AUTH?.trim();
  if (!basicAuth) return undefined;

  const separatorIndex = basicAuth.indexOf(":");
  if (separatorIndex === -1) return basicAuth;
  return basicAuth.slice(separatorIndex + 1).trim();
}

async function githubGet(token, path) {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText} for ${path}`);
  }
  return response.json();
}

/** Every successful run of a top-level "<Protocol> Acceptance" workflow on master, newest first. */
async function listSuccessfulAcceptanceRuns(token) {
  const runs = [];
  for (let page = 1; page <= MAX_RUN_LIST_PAGES; page++) {
    const data = await githubGet(token, `/repos/${OWNER}/${REPO}/actions/runs?branch=master&status=success&per_page=100&page=${page}`);
    runs.push(...data.workflow_runs);
    if (data.workflow_runs.length < 100 || runs.length >= data.total_count) break;
  }

  const acceptanceRuns = runs.filter((run) => run.name.endsWith("Acceptance") && !run.name.startsWith("Shared"));
  acceptanceRuns.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return acceptanceRuns;
}

async function findFinalReportArtifact(token, runId) {
  const data = await githubGet(token, `/repos/${OWNER}/${REPO}/actions/runs/${runId}/artifacts`);
  return data.artifacts.find((artifact) => artifact.name.startsWith("final-report")) ?? null;
}

/**
 * Not every successful Acceptance run actually produces a final-report artifact (e.g. a run whose
 * report-generation job got skipped via `needs:` on that particular trigger) — so this walks the
 * candidates newest-first and returns the first run/artifact pair that has one, rather than
 * assuming the single most recent match always does.
 */
async function findLatestRunWithFinalReport(token) {
  const runs = await listSuccessfulAcceptanceRuns(token);
  for (const run of runs) {
    const artifact = await findFinalReportArtifact(token, run.id);
    if (artifact) return { run, artifact };
  }
  return null;
}

/**
 * GitHub's artifact download redirects (302) to a time-limited, unauthenticated Azure Blob URL
 * that errors if the request still carries an Authorization header — so the redirect must be
 * followed manually, dropping the GitHub token before the second request. This is the one
 * deliberate exception to only ever talking to api.github.com in this script.
 */
async function downloadArtifactZip(token, archiveDownloadUrl) {
  const redirectResponse = await fetch(archiveDownloadUrl, {
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const location = redirectResponse.headers.get("location");
  if (!location) {
    throw new Error(`Expected a redirect from the artifact download URL, got ${redirectResponse.status}`);
  }
  const blobResponse = await fetch(location);
  if (!blobResponse.ok) {
    throw new Error(`Failed downloading artifact blob: ${blobResponse.status} ${blobResponse.statusText}`);
  }
  return Buffer.from(await blobResponse.arrayBuffer());
}

/** Rejects a zip entry whose name would resolve outside targetDir (zip-slip, e.g. "../../etc/foo" or an absolute path). */
function resolveEntryPath(targetDir, entryName) {
  const destPath = resolve(targetDir, entryName);
  const rel = relative(targetDir, destPath);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Refusing to extract zip entry outside target directory: ${entryName}`);
  }
  return destPath;
}

async function extractZip(zipBuffer, targetDir) {
  const zip = await JSZip.loadAsync(zipBuffer);
  await mkdir(targetDir, { recursive: true });
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const destPath = resolveEntryPath(targetDir, path);
    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, await entry.async("nodebuffer"));
  }
}

async function main() {
  loadEnvFile();
  const token = resolveGitHubToken();
  if (!token) {
    console.log("[acceptance-tests] No GitHub token (GITHUB_OAUTH_TOKEN/GITHUB_BASIC_AUTH) set — skipping (public/acceptance-tests/ left as-is)");
    return;
  }

  console.log("[acceptance-tests] Looking for the latest successful Acceptance run with a final-report artifact...");
  const found = await findLatestRunWithFinalReport(token);
  if (!found) {
    console.warn("[acceptance-tests] No successful Acceptance run with a final-report artifact found — leaving public/acceptance-tests/ as-is");
    return;
  }
  const { run, artifact } = found;
  console.log(`[acceptance-tests] Using run "${run.name}" #${run.run_number} (${run.html_url})`);

  const zipBuffer = await downloadArtifactZip(token, artifact.archive_download_url);

  // Extract into a scratch directory and swap it into place only once extraction fully succeeds,
  // so a failure partway through never leaves public/acceptance-tests/ missing or half-written.
  const scratchDir = await mkdtemp(join(tmpdir(), "acceptance-tests-"));
  await extractZip(zipBuffer, scratchDir);

  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(dirname(OUTPUT_DIR), { recursive: true });
  await rename(scratchDir, OUTPUT_DIR);

  console.log(`[acceptance-tests] Extracted "${artifact.name}" to ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error("[acceptance-tests] Failed:", error);
  process.exit(1);
});
