import { resolve } from "node:path";
import { getFileContent, type GitHubConfig, type RawPullRequestNode } from "../github-client";
import { runInBatches } from "../async";
import type { PullRequest, VulnerabilityRef } from "../types";
import { resolveAdvisory } from "./advisory-resolver";
import { loadKevSet } from "./kev-client";
import { extractCveRefs, isVulnRelevantModulePath } from "./module-cve-scan";
import { readModuleRefCache, writeModuleRefCache } from "./module-ref-cache";

export interface VulnEnrichmentConfig {
  github: GitHubConfig;
  cacheDir: string;
  advisoryTtlMs: number;
  nvdApiKey?: string;
  concurrency?: number;
}

/**
 * Finds CVE/GHSA references in each PR's title/description and touched exploit/auxiliary/post
 * module files (fetched at the PR's exact head commit, cached forever per PR+SHA since commit
 * content is immutable), then resolves each unique reference's CVSS/KEV data once and attaches
 * the results back to every PR that mentions it. Never throws — a failed lookup just leaves that
 * PR's vulnRefs empty or partial, logged as a warning.
 */
export async function enrichWithVulnerabilityRefs(
  pullRequests: PullRequest[],
  rawByNumber: Map<number, RawPullRequestNode>,
  config: VulnEnrichmentConfig
): Promise<PullRequest[]> {
  const moduleRefCachePath = resolve(config.cacheDir, "module-vuln-refs.json");
  const advisoryCachePath = resolve(config.cacheDir, "advisories.json");
  const kevCachePath = resolve(config.cacheDir, "kev.json");
  const concurrency = config.concurrency ?? 5;

  const refIdsByPr = new Map<number, Set<string>>();
  for (const pr of pullRequests) {
    refIdsByPr.set(pr.number, new Set(extractCveRefs(`${pr.title}\n${pr.description ?? ""}`)));
  }

  const prsWithModules = pullRequests.filter((pr) => {
    const paths = rawByNumber.get(pr.number)?.files?.nodes ?? [];
    return paths.some((file) => isVulnRelevantModulePath(file.path));
  });

  await runInBatches(prsWithModules, concurrency, async (pr) => {
    const raw = rawByNumber.get(pr.number);
    const headSha = raw?.commits.nodes[0]?.commit.oid;
    if (!raw || !headSha) return;

    const modulePaths = (raw.files?.nodes ?? []).map((file) => file.path).filter(isVulnRelevantModulePath);
    const cached = readModuleRefCache(moduleRefCachePath, config.github.owner, config.github.repo, pr.number, headSha);
    if (cached) {
      for (const id of cached) refIdsByPr.get(pr.number)?.add(id);
      return;
    }

    const found = new Set<string>();
    for (const path of modulePaths) {
      try {
        const content = await getFileContent(config.github, path, headSha);
        if (content) for (const id of extractCveRefs(content)) found.add(id);
      } catch (error) {
        console.warn(`[vuln] Failed to fetch ${path}@${headSha}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    writeModuleRefCache(moduleRefCachePath, config.github.owner, config.github.repo, pr.number, headSha, [...found]);
    for (const id of found) refIdsByPr.get(pr.number)?.add(id);
  });

  const uniqueIds = new Set<string>();
  for (const ids of refIdsByPr.values()) for (const id of ids) uniqueIds.add(id);

  const kevSet = await loadKevSet(kevCachePath);
  const resolvedById = new Map<string, VulnerabilityRef>();
  for (const id of uniqueIds) {
    const advisory = await resolveAdvisory(id, advisoryCachePath, config.advisoryTtlMs, config.nvdApiKey);
    const cveCandidate = /^CVE-/i.test(id) ? id : advisory.cveAliases[0];
    const knownExploited = kevSet === null ? null : cveCandidate ? kevSet.has(cveCandidate) : null;
    resolvedById.set(id, {
      id,
      cveAliases: advisory.cveAliases,
      cvssScore: advisory.cvssScore,
      cvssVector: advisory.cvssVector,
      cvssVersion: advisory.cvssVersion,
      source: advisory.source,
      status: advisory.status,
      knownExploited,
    });
  }

  return pullRequests.map((pr) => ({
    ...pr,
    vulnRefs: [...(refIdsByPr.get(pr.number) ?? [])].map((id) => resolvedById.get(id)).filter((ref): ref is VulnerabilityRef => ref !== undefined),
  }));
}
