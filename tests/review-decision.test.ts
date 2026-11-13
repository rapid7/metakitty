import { describe, expect, it } from "vitest";
import { mapReviewDecision } from "../src/lib/review-decision";

describe("mapReviewDecision", () => {
  it("lowercases GitHub's review decision enum", () => {
    expect(mapReviewDecision("APPROVED")).toBe("approved");
    expect(mapReviewDecision("CHANGES_REQUESTED")).toBe("changes_requested");
    expect(mapReviewDecision("REVIEW_REQUIRED")).toBe("review_required");
  });

  it("maps a null decision (no reviewers requested/submitted) to none", () => {
    expect(mapReviewDecision(null)).toBe("none");
  });
});
