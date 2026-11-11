import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readPullRequestCache, writePullRequestCache } from "../src/lib/pr-cache";
import type { RawPullRequestNode } from "../src/lib/github-client";

let dir: string;
let cachePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pr-cache-test-"));
  cachePath = join(dir, "nested", "github-pull-requests.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function node(number: number): RawPullRequestNode {
  return {
    number,
    title: `PR ${number}`,
    body: null,
    url: `https://github.com/rapid7/metasploit-framework/pull/${number}`,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    author: { login: "alice", avatarUrl: "" },
    comments: { totalCount: 0 },
    assignees: { nodes: [] },
    labels: { nodes: [] },
    reviewDecision: null,
    additions: 1,
    deletions: 0,
    changedFiles: 1,
    files: { nodes: [] },
    commits: { nodes: [] },
  };
}

it("returns null when no cache file exists", () => {
  expect(readPullRequestCache(cachePath, "rapid7", "metasploit-framework", 60_000)).toBeNull();
});

it("round-trips a write/read for the same owner and repo, creating nested directories", () => {
  writePullRequestCache(cachePath, "rapid7", "metasploit-framework", [node(1), node(2)]);
  const cached = readPullRequestCache(cachePath, "rapid7", "metasploit-framework", 60_000);
  expect(cached?.map((n) => n.number)).toEqual([1, 2]);
});

it("misses when the TTL has expired", () => {
  writePullRequestCache(cachePath, "rapid7", "metasploit-framework", [node(1)]);
  expect(readPullRequestCache(cachePath, "rapid7", "metasploit-framework", -1)).toBeNull();
});

it("treats a TTL of zero or less as disabled, even for a fresh cache", () => {
  writePullRequestCache(cachePath, "rapid7", "metasploit-framework", [node(1)]);
  expect(readPullRequestCache(cachePath, "rapid7", "metasploit-framework", 0)).toBeNull();
});

it("misses when the owner or repo doesn't match the cached entry", () => {
  writePullRequestCache(cachePath, "rapid7", "metasploit-framework", [node(1)]);
  expect(readPullRequestCache(cachePath, "rapid7", "metasploit-payloads", 60_000)).toBeNull();
  expect(readPullRequestCache(cachePath, "other-owner", "metasploit-framework", 60_000)).toBeNull();
});

it("misses gracefully on corrupt (non-JSON) cache contents", () => {
  mkdirSync(join(dir, "nested"), { recursive: true });
  writeFileSync(cachePath, "not valid json");
  expect(readPullRequestCache(cachePath, "rapid7", "metasploit-framework", 60_000)).toBeNull();
});
