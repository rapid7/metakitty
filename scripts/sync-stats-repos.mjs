#!/usr/bin/env node
// Synchronizes the committed stats repository list with public Rapid7 Cortex manifests. This is
// deliberately an explicit maintenance command rather than a build hook: STATS_REPOS determines
// static routes and historical-data fetches, so builds must use a reviewed, reproducible list.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const OWNER = "rapid7";
const DOMAIN = "metasploit";
const PRIMARY_REPO = "metasploit-framework";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const REPOS_PATH = resolve(process.cwd(), "src/lib/stats/repos.ts");
const CHECK_ONLY = process.argv.includes("--check");

const REPOSITORIES_QUERY = `
  query PublicRepositories($after: String) {
    organization(login: "${OWNER}") {
      repositories(first: 100, privacy: PUBLIC, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          name
          isArchived
          object(expression: "HEAD:cortex.yaml") {
            ... on Blob {
              text
            }
          }
        }
      }
    }
  }
`;

function loadEnvFile() {
  try {
    process.loadEnvFile();
  } catch {
    // A local .env file is optional; CI and other automation can provide the token directly.
  }
}

/** Mirrors src/lib/github-token.ts; this plain Node script cannot import TypeScript source. */
function resolveGitHubToken() {
  const direct = process.env.GITHUB_OAUTH_TOKEN?.trim();
  if (direct) return direct;

  const basicAuth = process.env.GITHUB_BASIC_AUTH?.trim();
  if (!basicAuth) return undefined;

  const separatorIndex = basicAuth.indexOf(":");
  if (separatorIndex === -1) return basicAuth;
  return basicAuth.slice(separatorIndex + 1).trim();
}

async function githubGraphql(token, query, variables) {
  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`GitHub GraphQL error: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  if (body.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${body.errors.map((error) => error.message).join("; ")}`);
  }
  return body.data;
}

/** Returns whether the manifest declares DOMAIN under x-cortex-domain-parents. */
function hasMetasploitDomain(manifest) {
  if (typeof manifest !== "string") return false;

  const lines = manifest.split(/\r?\n/);
  const parentsIndex = lines.findIndex((line) => /^\s*x-cortex-domain-parents:\s*$/.test(line));
  if (parentsIndex === -1) return false;

  for (const line of lines.slice(parentsIndex + 1)) {
    // Cortex manifests put this property below info:, so the next non-indented line ends its
    // value. A sibling property at the same indentation ends it as well.
    if (/^\S/.test(line) || /^ {2}[A-Za-z][A-Za-z0-9_-]*:/.test(line)) break;
    if (new RegExp(`^\\s*-\\s*tag:\\s*${DOMAIN}\\s*$`).test(line)) return true;
  }
  return false;
}

async function listDomainRepos(token) {
  const repos = [];
  let after = null;

  do {
    const data = await githubGraphql(token, REPOSITORIES_QUERY, { after });
    const connection = data.organization?.repositories;
    if (!connection) throw new Error(`Could not read public repositories for ${OWNER}`);

    for (const repo of connection.nodes) {
      if (!repo.isArchived && hasMetasploitDomain(repo.object?.text)) repos.push(repo.name);
    }
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);

  if (!repos.includes(PRIMARY_REPO)) {
    throw new Error(`The Cortex query did not return the primary repository (${PRIMARY_REPO})`);
  }
  return repos.sort(compareRepoNames);
}

/** Uses plain ASCII comparison so the generated source order does not depend on the host locale. */
function compareRepoNames(a, b) {
  const normalizedA = a.toLowerCase();
  const normalizedB = b.toLowerCase();
  if (normalizedA < normalizedB) return -1;
  if (normalizedA > normalizedB) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function renderRepos(repos) {
  return `export const STATS_REPOS: string[] = [\n${repos.map((repo) => `  "${repo}",`).join("\n")}\n];`;
}

function updateRepoList(source, repos) {
  const currentList = /export const STATS_REPOS: string\[\] = \[[\s\S]*?\n\];/;
  if (!currentList.test(source)) {
    throw new Error(`Could not locate STATS_REPOS in ${REPOS_PATH}`);
  }
  return source.replace(currentList, renderRepos(repos));
}

async function main() {
  loadEnvFile();
  const token = resolveGitHubToken();
  if (!token) {
    throw new Error("GITHUB_OAUTH_TOKEN or GITHUB_BASIC_AUTH must be set to synchronize STATS_REPOS");
  }

  console.log(`[stats-repos] Reading public ${OWNER} Cortex manifests for domain ${DOMAIN}...`);
  const repos = await listDomainRepos(token);
  const source = await readFile(REPOS_PATH, "utf8");
  const updatedSource = updateRepoList(source, repos);

  if (updatedSource === source) {
    console.log(`[stats-repos] STATS_REPOS already contains ${repos.length} Cortex ${DOMAIN} repositories.`);
    return;
  }
  if (CHECK_ONLY) {
    console.error("[stats-repos] STATS_REPOS is out of date. Run npm run sync:repos to update it.");
    process.exitCode = 1;
    return;
  }

  await writeFile(REPOS_PATH, updatedSource);
  console.log(`[stats-repos] Updated STATS_REPOS with ${repos.length} Cortex ${DOMAIN} repositories.`);
}

main().catch((error) => {
  console.error("[stats-repos] Failed:", error);
  process.exitCode = 1;
});
