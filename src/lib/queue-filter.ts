import type { PullRequest } from "./types";

export const nonModuleDescription =
  "Libraries, protocols, documentation, tooling, and dependencies. These changes may still affect module behavior.";

/** Rapid7 staff use a "-r7" GitHub username suffix; everyone else is a community contributor. */
export function isRapid7(author: string): boolean {
  return author.toLowerCase().endsWith("-r7");
}

export const queueFilterLabels = {
  open: "All open PRs",
  community: "Community-authored open PRs",
  rapid7: "Rapid7-authored open PRs",
  unassigned: "Unassigned open PRs",
  assigned: "Assigned open PRs",
  shared: "Open PRs with multiple assignees",
  research: "Open PRs with module changes",
  engineering: "Open PRs with non-module changes",
  docker: "Docker open PRs",
  linux: "Linux open PRs",
  windows: "Windows open PRs",
  macos: "macOS open PRs",
  android: "Android open PRs",
  unix: "Unix open PRs",
  bsd: "BSD open PRs",
  framework: "Framework / tooling open PRs",
  appliance: "Appliance / vendor image open PRs",
  multiple: "Multiple target environments",
  unknown: "Unknown target environment",
  "ci-passing": "Open PRs with passing CI",
  "ci-failing": "Open PRs with failing CI",
  "ci-pending": "Open PRs with pending or unknown CI",
  "review-approved": "Approved open PRs",
  "review-changes-requested": "Open PRs with changes requested",
  "review-required": "Open PRs awaiting review",
  aged: "Open PRs aged 30+ days",
  younger: "Open PRs younger than 30 days",
  oldest: "Oldest open PRs",
  created: "Open PRs by creation date",
  age: "Open PRs by age",
} as const;

export type QueueFilter = keyof typeof queueFilterLabels;
export type CreationInterval = { start: string; end: string; label: string; affiliation?: "community" | "rapid7" };
export type AgeInterval = { minDays: number; maxDays: number | null; label: string; affiliation?: "community" | "rapid7" };

/** Ported from gh-review's matchesQueueFilter, trimmed to fields this dashboard fetches. */
export function matchesQueueFilter(
  pr: PullRequest,
  filter: QueueFilter | null,
  oldestCreatedAt?: number,
  now = Date.now(),
  interval?: CreationInterval,
  ageInterval?: AgeInterval
): boolean {
  if (!filter) return true;
  switch (filter) {
    case "open": return true;
    case "created": return !!interval
      && Date.parse(pr.createdAt) >= Date.parse(interval.start)
      && Date.parse(pr.createdAt) < Date.parse(interval.end)
      && (!interval.affiliation || (isRapid7(pr.author) ? "rapid7" : "community") === interval.affiliation);
    case "age": {
      if (!ageInterval || !Number.isFinite(Date.parse(pr.createdAt))) return false;
      const ageDays = Math.max(0, now - Date.parse(pr.createdAt)) / 86_400_000;
      return ageDays >= ageInterval.minDays
        && (ageInterval.maxDays === null || ageDays < ageInterval.maxDays)
        && (!ageInterval.affiliation || (isRapid7(pr.author) ? "rapid7" : "community") === ageInterval.affiliation);
    }
    case "rapid7": return isRapid7(pr.author);
    case "community": return !isRapid7(pr.author);
    case "unassigned": return pr.assignees.length === 0;
    case "assigned": return pr.assignees.length > 0;
    case "shared": return new Set(pr.assignees.map((a) => a.login)).size > 1;
    case "research": return pr.modules.length > 0;
    case "engineering": return pr.modules.length === 0;
    case "ci-passing": return pr.ciStatus === "passing";
    case "ci-failing": return pr.ciStatus === "failing";
    case "ci-pending": return pr.ciStatus === "pending" || pr.ciStatus === "unknown";
    case "review-approved": return pr.reviewDecision === "approved";
    case "review-changes-requested": return pr.reviewDecision === "changes_requested";
    case "review-required": return pr.reviewDecision === "review_required" || pr.reviewDecision === "none";
    case "aged": return now - Date.parse(pr.createdAt) >= 30 * 86_400_000;
    case "younger": return Number.isFinite(Date.parse(pr.createdAt)) && now - Date.parse(pr.createdAt) < 30 * 86_400_000;
    case "oldest": return Date.parse(pr.createdAt) === oldestCreatedAt;
    default: return pr.testingEnv === filter;
  }
}
