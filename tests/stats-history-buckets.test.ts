import { describe, expect, it } from "vitest";
import { bucketRepoHistory } from "../src/lib/stats/history-buckets";
import { historicalIssue } from "./helpers";

const NOW = new Date("2026-11-10T12:00:00Z"); // currentYear = 2026

describe("bucketRepoHistory", () => {
  it("buckets a closed item from a fully-elapsed year as frozen", () => {
    const issue = historicalIssue({ state: "closed", createdAt: "2020-03-01T00:00:00Z" });
    const { frozen, hot } = bucketRepoHistory([issue], NOW);
    expect(frozen.get(2020)).toEqual([issue]);
    expect(hot.size).toBe(0);
  });

  it("buckets a still-open item from a fully-elapsed year as hot, keyed by its creation year", () => {
    const issue = historicalIssue({ state: "open", createdAt: "2015-06-01T00:00:00Z" });
    const { frozen, hot } = bucketRepoHistory([issue], NOW);
    expect(hot.get(2015)).toEqual([issue]);
    expect(frozen.size).toBe(0);
  });

  it("buckets anything created this year as hot, regardless of state", () => {
    const open = historicalIssue({ number: 1, state: "open", createdAt: "2026-01-05T00:00:00Z" });
    const closed = historicalIssue({ number: 2, state: "closed", createdAt: "2026-02-05T00:00:00Z" });
    const { frozen, hot } = bucketRepoHistory([open, closed], NOW);
    expect(hot.get(2026)).toEqual([open, closed]);
    expect(frozen.size).toBe(0);
  });

  it("groups multiple items from the same year into the same bucket", () => {
    const a = historicalIssue({ number: 1, state: "closed", createdAt: "2019-01-01T00:00:00Z" });
    const b = historicalIssue({ number: 2, state: "closed", createdAt: "2019-12-31T00:00:00Z" });
    const { frozen } = bucketRepoHistory([a, b], NOW);
    expect(frozen.get(2019)).toEqual([a, b]);
  });

  it("can produce both a frozen and a hot bucket for the same year — a repo's closed 2015 items alongside its still-open 2015 items", () => {
    const closed2015 = historicalIssue({ number: 1, state: "closed", createdAt: "2015-01-01T00:00:00Z" });
    const open2015 = historicalIssue({ number: 2, state: "open", createdAt: "2015-06-01T00:00:00Z" });
    const { frozen, hot } = bucketRepoHistory([closed2015, open2015], NOW);
    expect(frozen.get(2015)).toEqual([closed2015]);
    expect(hot.get(2015)).toEqual([open2015]);
  });

  it("returns empty maps for an empty input", () => {
    const { frozen, hot } = bucketRepoHistory([], NOW);
    expect(frozen.size).toBe(0);
    expect(hot.size).toBe(0);
  });
});
