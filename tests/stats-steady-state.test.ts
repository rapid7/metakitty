import { describe, expect, it } from "vitest";
import { getSteadyStateSeries, isOpenOn } from "../src/lib/stats/steady-state";
import { historicalIssue } from "./helpers";

describe("isOpenOn", () => {
  it("is open when created before the date and never closed", () => {
    const issue = historicalIssue({ createdAt: "2020-01-01T00:00:00Z", closedAt: null });
    expect(isOpenOn(issue, Date.parse("2026-01-01T00:00:00Z"))).toBe(true);
  });

  it("is open when created before and closed on-or-after the date", () => {
    const issue = historicalIssue({ createdAt: "2020-01-01T00:00:00Z", closedAt: "2020-06-01T00:00:00Z" });
    expect(isOpenOn(issue, Date.parse("2020-06-01T00:00:00Z"))).toBe(true);
    expect(isOpenOn(issue, Date.parse("2020-06-02T00:00:00Z"))).toBe(false);
  });

  it("is not open before the created date", () => {
    const issue = historicalIssue({ createdAt: "2020-01-01T00:00:00Z", closedAt: null });
    expect(isOpenOn(issue, Date.parse("2019-12-31T00:00:00Z"))).toBe(false);
  });
});

describe("getSteadyStateSeries", () => {
  it("weekly-samples open counts split all vs rapid7, keeping every point aligned", () => {
    const now = Date.parse("2011-01-22T00:00:00Z");
    const issues = [
      historicalIssue({ number: 1, reporter: "alice", createdAt: "2011-01-01T00:00:00Z", closedAt: null }),
      historicalIssue({ number: 2, reporter: "bob-r7", createdAt: "2011-01-08T00:00:00Z", closedAt: "2011-01-15T00:00:00Z" }),
    ];
    const series = getSteadyStateSeries(issues, () => true, now);
    expect(series).toEqual([
      { date: "2011-01-01T00:00:00.000Z", all: 1, rapid7: 0 },
      { date: "2011-01-08T00:00:00.000Z", all: 2, rapid7: 1 },
      { date: "2011-01-15T00:00:00.000Z", all: 2, rapid7: 1 },
      { date: "2011-01-22T00:00:00.000Z", all: 1, rapid7: 0 },
    ]);
  });

  it("only counts issues matching the category predicate", () => {
    const now = Date.parse("2011-01-01T00:00:00Z");
    const issues = [
      historicalIssue({ number: 1, pullRequest: true, createdAt: "2011-01-01T00:00:00Z" }),
      historicalIssue({ number: 2, pullRequest: false, createdAt: "2011-01-01T00:00:00Z" }),
    ];
    const series = getSteadyStateSeries(issues, (issue) => issue.pullRequest, now);
    expect(series).toEqual([{ date: "2011-01-01T00:00:00.000Z", all: 1, rapid7: 0 }]);
  });

  it("returns an empty series when now is before the series start", () => {
    expect(getSteadyStateSeries([], () => true, Date.parse("2000-01-01T00:00:00Z"))).toEqual([]);
  });
});
