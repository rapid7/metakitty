import type { RawModuleCommit } from "./module-commits-client";

export interface LandedModuleCommit {
  message: string;
  author: string;
  htmlUrl: string;
  date: string;
}

/** Filters to commits whose message references a landed PR ("Land #"), first 6 — metakitty's `commits_modules.json`. */
export function getLandedModuleCommits(commits: RawModuleCommit[], limit = 6): LandedModuleCommit[] {
  return commits
    .filter((commit) => commit.commit.message.includes("Land #"))
    .slice(0, limit)
    .map((commit) => ({
      message: commit.commit.message,
      author: commit.author?.login ?? commit.commit.author.name,
      htmlUrl: commit.html_url,
      date: commit.commit.author.date,
    }));
}
