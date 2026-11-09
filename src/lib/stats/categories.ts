import type { HistoricalIssue } from "./types";

export interface StatsCategory {
  label: string;
  matches: (issue: HistoricalIssue) => boolean;
}

/**
 * The 3 steady-state/quarterly-rate categories from metakitty, ported as a single source of truth
 * (the Ruby code duplicated these label checks per chart instead).
 */
export const STATS_CATEGORIES = {
  pullRequests: {
    label: "Open Pull Requests",
    matches: (issue) => issue.pullRequest,
  },
  bugs: {
    label: "Open Bugs",
    matches: (issue) => !issue.pullRequest && issue.labels.includes("bug"),
  },
  featuresAndEnhancements: {
    label: "Open Features and Enhancements",
    matches: (issue) => !issue.pullRequest && (issue.labels.includes("feature") || issue.labels.includes("enhancement")),
  },
} as const satisfies Record<string, StatsCategory>;

export type StatsCategoryKey = keyof typeof STATS_CATEGORIES;
