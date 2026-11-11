import { describe, expect, it } from "vitest";
import { getNewbieFriendlyIssues } from "../src/lib/stats/issues-newbie";
import { historicalIssue } from "./helpers";

describe("getNewbieFriendlyIssues", () => {
  it("includes only open, non-PR issues labeled newbie-friendly", () => {
    const items = getNewbieFriendlyIssues([
      historicalIssue({ number: 1, labels: ["newbie-friendly"], state: "open", pullRequest: false }),
      historicalIssue({ number: 2, labels: ["newbie-friendly"], state: "closed", pullRequest: false }),
      historicalIssue({ number: 3, labels: ["newbie-friendly"], state: "open", pullRequest: true }),
      historicalIssue({ number: 4, labels: ["bug"], state: "open", pullRequest: false }),
    ]);
    expect(items.map((item) => item.number)).toEqual([1]);
  });

  it("respects the limit", () => {
    const issues = Array.from({ length: 15 }, (_, index) => historicalIssue({ number: index, labels: ["newbie-friendly"], state: "open", pullRequest: false }));
    expect(getNewbieFriendlyIssues(issues, 10)).toHaveLength(10);
  });
});
