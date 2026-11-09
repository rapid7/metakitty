import { GITHUB_API_BASE, NotFoundError, restGet, restGetAllPages } from "../github-client";
import { STATS_OWNER } from "./repos";

export interface RawContributor {
  login?: string;
  contributions: number;
}

export interface GitHubUserProfile {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio?: string | null;
}

/** All-time contributor counts for a repo via REST, paginated. */
export async function fetchRepoContributorsAllTime(token: string, repo: string): Promise<RawContributor[]> {
  const url = `${GITHUB_API_BASE}repos/${STATS_OWNER}/${repo}/contributors?per_page=100`;
  return restGetAllPages<RawContributor>(token, url);
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
