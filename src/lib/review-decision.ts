import type { ReviewDecision } from "./types";

/** Maps GitHub's GraphQL `reviewDecision` enum to the lowercase union used throughout this app — shared between the queue dashboard's live PR fetch and the historical dataset's PR fetch. */
export function mapReviewDecision(decision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null): ReviewDecision {
  switch (decision) {
    case "APPROVED":
      return "approved";
    case "CHANGES_REQUESTED":
      return "changes_requested";
    case "REVIEW_REQUIRED":
      return "review_required";
    default:
      return "none";
  }
}
