import { describe, expect, it } from "vitest";
import { getTopCommitters } from "../src/lib/stats/top-committers";

describe("getTopCommitters", () => {
  it("counts commits per author, excluding the CI bot, sorted desc", () => {
    const authors = [{ author: "alice" }, { author: "msjenkins-r7" }, { author: "alice" }, { author: "bob-r7" }, { author: "msjenkins-r7" }];
    expect(getTopCommitters(authors)).toEqual([
      { author: "alice", count: 2 },
      { author: "bob-r7", count: 1 },
    ]);
  });

  it("breaks count ties alphabetically", () => {
    expect(getTopCommitters([{ author: "zara" }, { author: "amy" }])).toEqual([
      { author: "amy", count: 1 },
      { author: "zara", count: 1 },
    ]);
  });

  it("supports a custom exclusion list", () => {
    expect(getTopCommitters([{ author: "alice" }, { author: "bot" }], ["bot"])).toEqual([{ author: "alice", count: 1 }]);
  });

  it("handles an empty input", () => {
    expect(getTopCommitters([])).toEqual([]);
  });
});
