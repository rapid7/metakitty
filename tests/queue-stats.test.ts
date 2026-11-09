import { describe, expect, it } from "vitest";
import { getAssignmentStats, getCreationHistogram, getLabelCounts, getQueueStats } from "../src/lib/queue-stats";
import { pr } from "./helpers";

const now = Date.parse("2026-10-24T12:00:00Z");

describe("getQueueStats", () => {
  it("aggregates authorship, assignment, scope, CI, and review buckets", () => {
    const stats = getQueueStats(
      [
        pr({ number: 1, author: "alice", modules: ["exploits/windows/a"], ciStatus: "passing", reviewDecision: "approved", testingEnv: "windows" }),
        pr({ number: 2, author: "bob-r7", assignees: [{ login: "bob-r7", avatarUrl: null }], ciStatus: "failing", reviewDecision: "changes_requested", testingEnv: "linux", createdAt: "2026-09-24T12:00:00Z" }),
        pr({ number: 3, author: "carol", testingEnv: "unknown" }),
      ],
      now
    );
    expect(stats.total).toBe(3);
    expect(stats.authors).toBe(3);
    expect(stats.rapid7).toBe(1);
    expect(stats.community).toBe(2);
    expect(stats.unassigned).toBe(2);
    expect(stats.research).toBe(1);
    expect(stats.engineering).toBe(2);
    expect(stats.testing).toMatchObject({ windows: 1, linux: 1, unknown: 1 });
    expect(stats.ci).toMatchObject({ passing: 1, failing: 1, pending: 0, unknown: 1 });
    expect(stats.review).toMatchObject({ approved: 1, changes_requested: 1, review_required: 0, none: 1 });
    expect(stats.olderThan30Days).toBe(1);
  });

  it("handles an empty queue without invalid percentages or ages", () => {
    const stats = getQueueStats([], now);
    expect(stats.total).toBe(0);
    expect(stats.averageAge).toBe(0);
    expect(stats.oldestAge).toBe(0);
  });

  it("excludes invalid creation dates from age calculations", () => {
    const stats = getQueueStats([pr({ createdAt: "invalid" })], now);
    expect(stats.averageAge).toBe(0);
    expect(stats.oldestAge).toBe(0);
  });
});

describe("getAssignmentStats", () => {
  it("counts assigned PRs once and shared PRs toward each person's workload", () => {
    const alice = { login: "alice", avatarUrl: null };
    const bob = { login: "bob", avatarUrl: null };
    const prs = [pr({ assignees: [alice, bob, alice] }), pr({ number: 2, assignees: [alice] }), pr({ number: 3, assignees: [] })];
    expect(getAssignmentStats(prs)).toEqual({
      assigned: 2,
      unassigned: 1,
      coverage: 67,
      shared: 1,
      people: [{ login: "alice", count: 2 }, { login: "bob", count: 1 }],
    });
  });

  it("handles empty queues", () => {
    expect(getAssignmentStats([])).toEqual({ assigned: 0, unassigned: 0, coverage: 0, shared: 0, people: [] });
  });
});

describe("getCreationHistogram", () => {
  it("uses UTC calendar months and includes gaps", () => {
    expect(
      getCreationHistogram([
        pr({ createdAt: "2025-12-31T23:59:59Z" }),
        pr({ createdAt: "2026-01-01T00:30:00+01:00", author: "bob-r7" }),
        pr({ createdAt: "2026-02-01T00:00:00Z" }),
        pr({ createdAt: "invalid" }),
      ])
    ).toEqual([
      { start: "2025-12-01T00:00:00.000Z", end: "2026-01-01T00:00:00.000Z", count: 2, community: 1, rapid7: 1 },
      { start: "2026-01-01T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z", count: 0, community: 0, rapid7: 0 },
      { start: "2026-02-01T00:00:00.000Z", end: "2026-03-01T00:00:00.000Z", count: 1, community: 1, rapid7: 0 },
    ]);
    expect(getCreationHistogram([])).toEqual([]);
  });
});

describe("getLabelCounts", () => {
  it("counts labels across PRs, most frequent first", () => {
    const counts = getLabelCounts([
      pr({ labels: [{ name: "bug", color: "d73a4a" }, { name: "module", color: "0e8a16" }] }),
      pr({ number: 2, labels: [{ name: "module", color: "0e8a16" }] }),
    ]);
    expect(counts).toEqual([
      { name: "module", color: "0e8a16", count: 2 },
      { name: "bug", color: "d73a4a", count: 1 },
    ]);
  });
});
