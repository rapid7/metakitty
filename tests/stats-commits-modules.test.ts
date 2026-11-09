import { describe, expect, it } from "vitest";
import { getLandedModuleCommits } from "../src/lib/stats/commits-modules";
import type { RawModuleCommit } from "../src/lib/stats/module-commits-client";

function commit(overrides: Partial<RawModuleCommit> = {}): RawModuleCommit {
  return {
    html_url: "https://github.com/rapid7/metasploit-framework/commit/abc",
    commit: { message: "Land #1, Add a module", author: { name: "alice", date: "2026-01-01T00:00:00Z" } },
    author: { login: "alice" },
    ...overrides,
  };
}

describe("getLandedModuleCommits", () => {
  it("filters to commit messages referencing a landed PR", () => {
    const commits = getLandedModuleCommits([commit(), commit({ commit: { message: "Unrelated cleanup", author: { name: "bob", date: "2026-01-02T00:00:00Z" } } })]);
    expect(commits).toHaveLength(1);
    expect(commits[0].message).toContain("Land #1");
  });

  it("falls back to the git author name when there's no GitHub account", () => {
    const commits = getLandedModuleCommits([commit({ author: null, commit: { message: "Land #2", author: { name: "ghost-author", date: "2026-01-01T00:00:00Z" } } })]);
    expect(commits[0].author).toBe("ghost-author");
  });

  it("respects the limit", () => {
    const commits = Array.from({ length: 10 }, () => commit());
    expect(getLandedModuleCommits(commits, 3)).toHaveLength(3);
  });
});
