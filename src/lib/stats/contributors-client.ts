import { GITHUB_API_BASE, NotFoundError, restGet, restGetAllPages } from "../github-client";
import { STATS_OWNER } from "./repos";

export interface RawContributor {
  login?: string;
  /** Only present on an `anon=true` "Anonymous" entry — GitHub's stats generator couldn't link the commits to a verified account, so there's no `login`, just whatever name/email git recorded. */
  name?: string;
  email?: string;
  contributions: number;
}

export interface GitHubUserProfile {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio?: string | null;
}

/**
 * All-time contributor counts for a repo via REST, paginated. `anon=true` also includes commits
 * GitHub's stats generator couldn't link to a verified account (returned as `type: "Anonymous"`,
 * `login` absent) — without it, long-tenured contributors whose early history predates their
 * account's email verification (e.g. metasploit-framework's founder, who pre-dates GitHub itself)
 * are silently dropped entirely rather than just appearing under a fallback identity.
 */
export async function fetchRepoContributorsAllTime(token: string, repo: string): Promise<RawContributor[]> {
  const url = `${GITHUB_API_BASE}repos/${STATS_OWNER}/${repo}/contributors?per_page=100&anon=true`;
  return restGetAllPages<RawContributor>(token, url, `${STATS_OWNER}/${repo} contributors`);
}

/** Returns null (rather than throwing) for a deleted/renamed account, since a stale alias/login shouldn't fail the whole build. */
export async function fetchUserProfile(token: string, login: string): Promise<GitHubUserProfile | null> {
  try {
    const { data } = await restGet<GitHubUserProfile>(token, `${GITHUB_API_BASE}users/${encodeURIComponent(login)}`);
    return data;
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
