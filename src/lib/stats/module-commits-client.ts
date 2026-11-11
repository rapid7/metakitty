import { GITHUB_API_BASE, restGetAllPages } from "../github-client";
import { STATS_OWNER } from "./repos";

export interface RawModuleCommit {
  html_url: string;
  commit: { message: string; author: { name: string; date: string } };
  author: { login: string } | null;
}

const MODULE_COMMITS_REPO = "metasploit-framework";

/** Commits touching modules/ in rapid7/metasploit-framework since `sinceIso` — metakitty only ever looked at this one repo for "recently landed modules". */
export async function fetchModuleCommitsSince(token: string, sinceIso: string): Promise<RawModuleCommit[]> {
  const url = `${GITHUB_API_BASE}repos/${STATS_OWNER}/${MODULE_COMMITS_REPO}/commits?since=${encodeURIComponent(sinceIso)}&path=modules&per_page=100`;
  return restGetAllPages<RawModuleCommit>(token, url, `${STATS_OWNER}/${MODULE_COMMITS_REPO} module commits`);
}
