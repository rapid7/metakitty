import { queueFilterLabels, type AgeInterval, type CreationInterval, type QueueFilter } from "./queue-filter";
import { testingEnvironmentLabels } from "./testing-environment";
import type { CiStatus, ReviewDecision, TestingEnvironment } from "./types";

export type SortField =
  | "number"
  | "cvss"
  | "vulnKnownExploited"
  | "vulnCoverage"
  | "title"
  | "author"
  | "assignee"
  | "createdAt"
  | "filesChanged"
  | "ci"
  | "review"
  | "area"
  | "testingEnv"
  | "commentCount";
export type SortDirection = "asc" | "desc";
export type TestingFilter = "all" | TestingEnvironment;
export type ScopeFilter = "all" | "research" | "engineering";
export type CiFilter = "all" | CiStatus;
export type ReviewFilter = "all" | ReviewDecision;
/** Which of QueueOverview's popover dialogs, if any, is open. */
export type QueueDialogId = "histogram" | "age-histogram" | "assignment-histogram" | "by-assignee";

const SORT_FIELDS: SortField[] = [
  "number", "cvss", "vulnKnownExploited", "vulnCoverage", "title", "author", "assignee",
  "createdAt", "filesChanged", "ci", "review", "area", "testingEnv", "commentCount",
];
const TESTING_FILTERS: TestingFilter[] = ["all", ...(Object.keys(testingEnvironmentLabels) as TestingEnvironment[])];
const SCOPE_FILTERS: ScopeFilter[] = ["all", "research", "engineering"];
const CI_FILTERS: CiFilter[] = ["all", "passing", "failing", "pending", "unknown"];
const REVIEW_FILTERS: ReviewFilter[] = ["all", "approved", "changes_requested", "review_required", "none"];
const DIALOG_IDS: QueueDialogId[] = ["histogram", "age-histogram", "assignment-histogram", "by-assignee"];

/** The dashboard's full set of filter/sort/search selections, as encoded into the URL query string. */
export interface UrlFilterState {
  queueFilter: QueueFilter | null;
  creationInterval?: CreationInterval;
  ageInterval?: AgeInterval;
  assigneeFilter: string;
  testingFilter: TestingFilter;
  scopeFilter: ScopeFilter;
  ciFilter: CiFilter;
  reviewFilter: ReviewFilter;
  labelFilter: string;
  search: string;
  sortField: SortField;
  sortDirection: SortDirection;
  openDialog: QueueDialogId | null;
}

/** Parses a `location.search`-style query string, falling back to defaults for anything missing or invalid. */
export function readUrlFilterState(search: string): UrlFilterState {
  const params = new URLSearchParams(search);
  const filterParam = params.get("filter");
  const queueFilter = filterParam && filterParam in queueFilterLabels ? (filterParam as QueueFilter) : null;
  const start = params.get("start");
  const end = params.get("end");
  const minDaysParam = params.get("agemin");
  const minDays = minDaysParam === null ? NaN : Number(minDaysParam);
  const maxDaysParam = params.get("agemax");
  const affiliationParam = params.get("affiliation");
  const sortParam = params.get("sort");
  const dialogParam = params.get("dialog");

  return {
    queueFilter,
    creationInterval:
      queueFilter === "created" && start && end
        ? {
            start,
            end,
            label: params.get("clabel") ?? "",
            affiliation: affiliationParam === "community" || affiliationParam === "rapid7" ? affiliationParam : undefined,
          }
        : undefined,
    ageInterval:
      queueFilter === "age" && Number.isFinite(minDays)
        ? {
            minDays,
            maxDays: maxDaysParam !== null && Number.isFinite(Number(maxDaysParam)) ? Number(maxDaysParam) : null,
            label: params.get("alabel") ?? "",
            affiliation: affiliationParam === "community" || affiliationParam === "rapid7" ? affiliationParam : undefined,
          }
        : undefined,
    assigneeFilter: params.get("assignee") ?? "all",
    testingFilter: TESTING_FILTERS.includes(params.get("env") as TestingFilter) ? (params.get("env") as TestingFilter) : "all",
    scopeFilter: SCOPE_FILTERS.includes(params.get("scope") as ScopeFilter) ? (params.get("scope") as ScopeFilter) : "all",
    ciFilter: CI_FILTERS.includes(params.get("ci") as CiFilter) ? (params.get("ci") as CiFilter) : "all",
    reviewFilter: REVIEW_FILTERS.includes(params.get("review") as ReviewFilter) ? (params.get("review") as ReviewFilter) : "all",
    labelFilter: params.get("tag") ?? "all",
    search: params.get("q") ?? "",
    sortField: SORT_FIELDS.includes(sortParam as SortField) ? (sortParam as SortField) : "createdAt",
    sortDirection: params.get("dir") === "asc" ? "asc" : "desc",
    openDialog: DIALOG_IDS.includes(dialogParam as QueueDialogId) ? (dialogParam as QueueDialogId) : null,
  };
}

/** Inverse of {@link readUrlFilterState}: encodes the dashboard's state, omitting defaults, so the URL stays shareable and tidy. */
export function writeUrlFilterState(state: UrlFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.queueFilter) {
    params.set("filter", state.queueFilter);
    if (state.queueFilter === "created" && state.creationInterval) {
      params.set("start", state.creationInterval.start);
      params.set("end", state.creationInterval.end);
      if (state.creationInterval.label) params.set("clabel", state.creationInterval.label);
      if (state.creationInterval.affiliation) params.set("affiliation", state.creationInterval.affiliation);
    }
    if (state.queueFilter === "age" && state.ageInterval) {
      params.set("agemin", String(state.ageInterval.minDays));
      if (state.ageInterval.maxDays !== null) params.set("agemax", String(state.ageInterval.maxDays));
      if (state.ageInterval.label) params.set("alabel", state.ageInterval.label);
      if (state.ageInterval.affiliation) params.set("affiliation", state.ageInterval.affiliation);
    }
  }
  if (state.assigneeFilter !== "all") params.set("assignee", state.assigneeFilter);
  if (state.testingFilter !== "all") params.set("env", state.testingFilter);
  if (state.scopeFilter !== "all") params.set("scope", state.scopeFilter);
  if (state.ciFilter !== "all") params.set("ci", state.ciFilter);
  if (state.reviewFilter !== "all") params.set("review", state.reviewFilter);
  if (state.labelFilter !== "all") params.set("tag", state.labelFilter);
  if (state.search) params.set("q", state.search);
  if (state.sortField !== "createdAt") params.set("sort", state.sortField);
  if (state.sortDirection !== "desc") params.set("dir", state.sortDirection);
  if (state.openDialog) params.set("dialog", state.openDialog);
  return params;
}
