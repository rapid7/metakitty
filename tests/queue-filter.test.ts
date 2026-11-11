import { describe, expect, it } from "vitest";
import { matchesQueueFilter } from "../src/lib/queue-filter";
import { pr } from "./helpers";

const now = Date.parse("2026-10-24T12:00:00Z");

it("returns true for a null filter and false for everything else when the filter is unrecognized", () => {
  expect(matchesQueueFilter(pr(), null)).toBe(true);
  expect(matchesQueueFilter(pr(), "open")).toBe(true);
});

it("splits authorship using a case-insensitive -r7 suffix", () => {
  const prs = [pr({ author: "alice-r7" }), pr({ author: "bob-R7" }), pr({ author: "r7-charlie" })];
  expect(prs.filter((p) => matchesQueueFilter(p, "rapid7"))).toHaveLength(2);
  expect(prs.filter((p) => matchesQueueFilter(p, "community"))).toHaveLength(1);
});

it("matches assignment filters", () => {
  const alice = { login: "alice", avatarUrl: null };
  const bob = { login: "bob", avatarUrl: null };
  expect(matchesQueueFilter(pr({ assignees: [] }), "unassigned")).toBe(true);
  expect(matchesQueueFilter(pr({ assignees: [alice] }), "unassigned")).toBe(false);
  expect(matchesQueueFilter(pr({ assignees: [alice] }), "assigned")).toBe(true);
  expect(matchesQueueFilter(pr({ assignees: [alice, bob] }), "shared")).toBe(true);
  expect(matchesQueueFilter(pr({ assignees: [alice] }), "shared")).toBe(false);
});

it("matches change-scope filters", () => {
  expect(matchesQueueFilter(pr({ modules: ["exploits/windows/foo"] }), "research")).toBe(true);
  expect(matchesQueueFilter(pr({ modules: [] }), "research")).toBe(false);
  expect(matchesQueueFilter(pr({ modules: [] }), "engineering")).toBe(true);
});

it("matches CI status filters, treating pending and unknown alike", () => {
  expect(matchesQueueFilter(pr({ ciStatus: "passing" }), "ci-passing")).toBe(true);
  expect(matchesQueueFilter(pr({ ciStatus: "failing" }), "ci-failing")).toBe(true);
  expect(matchesQueueFilter(pr({ ciStatus: "pending" }), "ci-pending")).toBe(true);
  expect(matchesQueueFilter(pr({ ciStatus: "unknown" }), "ci-pending")).toBe(true);
  expect(matchesQueueFilter(pr({ ciStatus: "passing" }), "ci-failing")).toBe(false);
});

it("matches review decision filters, treating review-required and none alike", () => {
  expect(matchesQueueFilter(pr({ reviewDecision: "approved" }), "review-approved")).toBe(true);
  expect(matchesQueueFilter(pr({ reviewDecision: "changes_requested" }), "review-changes-requested")).toBe(true);
  expect(matchesQueueFilter(pr({ reviewDecision: "review_required" }), "review-required")).toBe(true);
  expect(matchesQueueFilter(pr({ reviewDecision: "none" }), "review-required")).toBe(true);
});

it("matches target-environment filters via the default case", () => {
  expect(matchesQueueFilter(pr({ testingEnv: "docker" }), "docker")).toBe(true);
  expect(matchesQueueFilter(pr({ testingEnv: "windows" }), "docker")).toBe(false);
});

describe("age filters", () => {
  it("treats invalid creation dates as neither aged nor younger", () => {
    expect(matchesQueueFilter(pr({ createdAt: "invalid" }), "aged", undefined, now)).toBe(false);
    expect(matchesQueueFilter(pr({ createdAt: "invalid" }), "younger", undefined, now)).toBe(false);
  });

  it("classifies by the 30-day threshold", () => {
    expect(matchesQueueFilter(pr({ createdAt: "2026-09-01T12:00:00Z" }), "aged", undefined, now)).toBe(true);
    expect(matchesQueueFilter(pr({ createdAt: "2026-10-20T12:00:00Z" }), "younger", undefined, now)).toBe(true);
  });

  it("matches the oldest PR by exact timestamp, including ties", () => {
    const oldest = Date.parse("2026-09-01T12:00:00Z");
    expect(matchesQueueFilter(pr({ createdAt: new Date(oldest).toISOString() }), "oldest", oldest, now)).toBe(true);
    expect(matchesQueueFilter(pr({ createdAt: "invalid" }), "oldest", oldest, now)).toBe(false);
  });
});

describe("creation interval filter", () => {
  const interval = { start: "2026-10-01T00:00:00Z", end: "2026-11-01T00:00:00Z", label: "Oct 2026" };

  it("matches an inclusive start and exclusive end", () => {
    const matches = (createdAt: string) => matchesQueueFilter(pr({ createdAt }), "created", undefined, now, interval);
    expect(matches(interval.start)).toBe(true);
    expect(matches("2026-10-31T23:59:59Z")).toBe(true);
    expect(matches(interval.end)).toBe(false);
    expect(matches("2026-09-30T23:59:59Z")).toBe(false);
  });

  it("filters by affiliation when provided", () => {
    const community = pr({ author: "alice", createdAt: "2026-10-15T00:00:00Z" });
    const rapid7 = pr({ author: "bob-r7", createdAt: "2026-10-15T00:00:00Z" });
    expect(matchesQueueFilter(community, "created", undefined, now, { ...interval, affiliation: "community" })).toBe(true);
    expect(matchesQueueFilter(rapid7, "created", undefined, now, { ...interval, affiliation: "community" })).toBe(false);
    expect(matchesQueueFilter(rapid7, "created", undefined, now, { ...interval, affiliation: "rapid7" })).toBe(true);
  });

  it("returns false without an interval", () => {
    expect(matchesQueueFilter(pr(), "created")).toBe(false);
  });
});

describe("age interval filter", () => {
  const interval = { minDays: 7, maxDays: 30, label: "7–29 days" };

  it("matches an inclusive minimum and exclusive maximum", () => {
    const matches = (createdAt: string) => matchesQueueFilter(pr({ createdAt }), "age", undefined, now, undefined, interval);
    expect(matches("2026-10-17T12:00:00Z")).toBe(true); // exactly 7 days old
    expect(matches("2026-09-25T12:00:00Z")).toBe(true); // exactly 29 days old
    expect(matches("2026-10-24T12:00:00Z")).toBe(false); // 0 days old
    expect(matches("2026-09-24T12:00:00Z")).toBe(false); // exactly 30 days old
  });

  it("treats an open-ended maxDays (null) as unbounded", () => {
    const matches = matchesQueueFilter(pr({ createdAt: "2024-01-01T12:00:00Z" }), "age", undefined, now, undefined, { minDays: 365, maxDays: null, label: "365+ days" });
    expect(matches).toBe(true);
  });

  it("filters by affiliation when provided", () => {
    const community = pr({ author: "alice", createdAt: "2026-10-15T00:00:00Z" });
    const rapid7 = pr({ author: "bob-r7", createdAt: "2026-10-15T00:00:00Z" });
    expect(matchesQueueFilter(community, "age", undefined, now, undefined, { ...interval, affiliation: "community" })).toBe(true);
    expect(matchesQueueFilter(rapid7, "age", undefined, now, undefined, { ...interval, affiliation: "community" })).toBe(false);
    expect(matchesQueueFilter(rapid7, "age", undefined, now, undefined, { ...interval, affiliation: "rapid7" })).toBe(true);
  });

  it("returns false without an interval, or with an invalid creation date", () => {
    expect(matchesQueueFilter(pr(), "age", undefined, now)).toBe(false);
    expect(matchesQueueFilter(pr({ createdAt: "invalid" }), "age", undefined, now, undefined, interval)).toBe(false);
  });
});
