import { EXCLUDED_CONTRIBUTORS } from "./contributor-aliases";
import type { GitHubUserProfile } from "./contributors-client";
import type { MergedByCount } from "./merged-by";

export interface ContributorInfo {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  contributions: number;
}

/** Counts how many times each login appears (used for commit-author lists that need counting before aggregation). */
export function countLogins(logins: string[]): Array<{ login: string; contributions: number }> {
  const counts = new Map<string, number>();
  for (const login of logins) counts.set(login, (counts.get(login) ?? 0) + 1);
  return [...counts.entries()].map(([login, contributions]) => ({ login, contributions }));
}

/** Merges aliased logins and excludes the CI bot, summing contribution counts per resolved identity. */
export function aggregateContributors(
  rawCounts: Array<{ login: string; contributions: number }>,
  aliases: Record<string, string>,
  excluded: string[] = EXCLUDED_CONTRIBUTORS
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { login, contributions } of rawCounts) {
    const id = aliases[login] ?? login;
    if (excluded.includes(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + contributions);
  }
  return counts;
}

/** Sorts by contribution count desc, drops any identity without a resolved profile, caps at `limit` (metakitty caps at 30). */
export function topContributorInfos(counts: Map<string, number>, profilesByLogin: Map<string, GitHubUserProfile>, limit = 30): ContributorInfo[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([login]) => profilesByLogin.has(login))
    .slice(0, limit)
    .map(([login, contributions]) => {
      const profile = profilesByLogin.get(login)!;
      return { login, name: profile.name, avatarUrl: profile.avatar_url, htmlUrl: profile.html_url, contributions };
    });
}

/** Adapts a commit-contributions row to the {@link MergedByCount} shape so it can reuse the merged-by bar chart/table components. */
export function toMergedByCount(info: ContributorInfo): MergedByCount {
  return { login: info.login, count: info.contributions, avatarUrl: info.avatarUrl };
}
