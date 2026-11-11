import { describe, expect, it } from "vitest";
import { getWeeklyNewItems } from "../src/lib/stats/weekly-new-items";
import { historicalIssue } from "./helpers";

describe("getWeeklyNewItems", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");

  it("includes only items created in the last 7 days, newest first", () => {
    const items = getWeeklyNewItems(
      [
        historicalIssue({ number: 1, title: "Too old", createdAt: "2026-10-01T00:00:00Z" }),
        historicalIssue({ number: 2, title: "This week, earlier", createdAt: "2026-10-20T00:00:00Z" }),
        historicalIssue({ number: 3, title: "This week, later", createdAt: "2026-10-23T00:00:00Z" }),
        historicalIssue({ number: 4, title: "Right now", createdAt: "2026-10-24T12:00:00Z" }),
      ],
      () => true,
      now
    );
    expect(items.map((item) => item.number)).toEqual([4, 3, 2]);
  });

  it("only matches issues passing the category predicate", () => {
    const items = getWeeklyNewItems(
      [historicalIssue({ number: 1, pullRequest: true, createdAt: "2026-10-23T00:00:00Z" }), historicalIssue({ number: 2, pullRequest: false, createdAt: "2026-10-23T00:00:00Z" })],
      (issue) => issue.pullRequest,
      now
    );
    expect(items.map((item) => item.number)).toEqual([1]);
  });
});
