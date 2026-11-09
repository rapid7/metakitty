import { describe, expect, it } from "vitest";
import { aggregateContributors, countLogins, topContributorInfos } from "../src/lib/stats/contributors";
import type { GitHubUserProfile } from "../src/lib/stats/contributors-client";

describe("countLogins", () => {
  it("counts occurrences per login", () => {
    expect(countLogins(["alice", "bob", "alice"])).toEqual(
      expect.arrayContaining([{ login: "alice", contributions: 2 }, { login: "bob", contributions: 1 }])
    );
  });
});

describe("aggregateContributors", () => {
  it("merges aliased logins into one identity and excludes the CI bot", () => {
    const counts = aggregateContributors(
      [
        { login: "jlee-r7", contributions: 10 },
        { login: "egypt", contributions: 5 },
        { login: "msjenkins-r7", contributions: 999 },
      ],
      { "jlee-r7": "egypt" },
      ["msjenkins-r7"]
    );
    expect(counts.get("egypt")).toBe(15);
    expect(counts.has("msjenkins-r7")).toBe(false);
  });
});

describe("topContributorInfos", () => {
  const profile = (login: string): GitHubUserProfile => ({ login, name: login, avatar_url: `https://a/${login}`, html_url: `https://github.com/${login}` });

  it("sorts by contribution count desc and drops identities without a resolved profile", () => {
    const counts = new Map([["alice", 10], ["bob", 20], ["carol", 5]]);
    const profiles = new Map([["alice", profile("alice")], ["bob", profile("bob")]]);
    expect(topContributorInfos(counts, profiles)).toEqual([
      { login: "bob", name: "bob", avatarUrl: "https://a/bob", htmlUrl: "https://github.com/bob", contributions: 20 },
      { login: "alice", name: "alice", avatarUrl: "https://a/alice", htmlUrl: "https://github.com/alice", contributions: 10 },
    ]);
  });

  it("caps at the limit", () => {
    const counts = new Map(Array.from({ length: 5 }, (_, i) => [`user${i}`, i] as const));
    const profiles = new Map(Array.from({ length: 5 }, (_, i) => [`user${i}`, profile(`user${i}`)] as const));
    expect(topContributorInfos(counts, profiles, 2)).toHaveLength(2);
  });
});
