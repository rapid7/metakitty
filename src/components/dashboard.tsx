"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QueueOverview } from "@/components/queue-overview";
import { PullRequestTable } from "@/components/pull-request-table";
import { getLabelCounts } from "@/lib/queue-stats";
import { matchesQueueFilter, queueFilterLabels, type AgeInterval, type CreationInterval, type QueueFilter } from "@/lib/queue-filter";
import {
  readUrlFilterState,
  writeUrlFilterState,
  type CiFilter,
  type QueueDialogId,
  type ReviewFilter,
  type ScopeFilter,
  type SortDirection,
  type SortField,
  type TestingFilter,
} from "@/lib/dashboard-filters";
import { testingEnvironmentLabels } from "@/lib/testing-environment";
import { vulnerabilitySummary } from "@/lib/vulnerability-summary";
import type { PullRequest } from "@/lib/types";

export type { SortDirection, SortField } from "@/lib/dashboard-filters";

const VULN_SORT_FIELDS: SortField[] = ["cvss", "vulnKnownExploited", "vulnCoverage"];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function Dashboard({
  owner,
  repo,
  repos,
  repoPrCounts,
  pullRequests,
  generatedAt,
}: {
  owner: string;
  repo: string;
  repos: string[];
  repoPrCounts: Record<string, number>;
  pullRequests: PullRequest[];
  generatedAt: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [testingFilter, setTestingFilter] = useState<TestingFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [ciFilter, setCiFilter] = useState<CiFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [labelFilter, setLabelFilter] = useState("all");
  const [queueFilter, setQueueFilter] = useState<QueueFilter | null>(null);
  const [oldestCreatedAt, setOldestCreatedAt] = useState<number>();
  const [creationInterval, setCreationInterval] = useState<CreationInterval>();
  const [ageInterval, setAgeInterval] = useState<AgeInterval>();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [openDialog, setOpenDialog] = useState<QueueDialogId | null>(null);
  const [hydratedFromUrl, setHydratedFromUrl] = useState(false);

  // Applies a shared link's selections once on mount, then hands off to the effect below, which
  // keeps the URL in sync with every later change so the current view stays linkable.
  useEffect(() => {
    const state = readUrlFilterState(window.location.search);
    setQueueFilter(state.queueFilter);
    setCreationInterval(state.creationInterval);
    setAgeInterval(state.ageInterval);
    setOldestCreatedAt(
      state.queueFilter === "oldest"
        ? Math.min(...pullRequests.map((pr) => Date.parse(pr.createdAt)).filter(Number.isFinite))
        : undefined
    );
    setAssigneeFilter(state.assigneeFilter);
    setTestingFilter(state.testingFilter);
    setScopeFilter(state.scopeFilter);
    setCiFilter(state.ciFilter);
    setReviewFilter(state.reviewFilter);
    setLabelFilter(state.labelFilter);
    setSearchInput(state.search);
    setSortField(state.sortField);
    setSortDirection(state.sortDirection);
    setOpenDialog(state.openDialog);
    setHydratedFromUrl(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydratedFromUrl) return;
    const query = writeUrlFilterState({
      queueFilter,
      creationInterval,
      ageInterval,
      assigneeFilter,
      testingFilter,
      scopeFilter,
      ciFilter,
      reviewFilter,
      labelFilter,
      search: debouncedSearch,
      sortField,
      sortDirection,
      openDialog,
    }).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [
    hydratedFromUrl,
    queueFilter,
    creationInterval,
    ageInterval,
    assigneeFilter,
    testingFilter,
    scopeFilter,
    ciFilter,
    reviewFilter,
    labelFilter,
    debouncedSearch,
    sortField,
    sortDirection,
    openDialog,
    pathname,
    router,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Counts reflect the other filters, before filtering by assignee.
  const scopedPullRequests = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return pullRequests.filter((pr) => {
      if (!matchesQueueFilter(pr, queueFilter, oldestCreatedAt, undefined, creationInterval, ageInterval)) return false;
      if (testingFilter !== "all" && pr.testingEnv !== testingFilter) return false;
      if (scopeFilter === "research" && pr.modules.length === 0) return false;
      if (scopeFilter === "engineering" && pr.modules.length > 0) return false;
      if (ciFilter !== "all" && pr.ciStatus !== ciFilter) return false;
      if (reviewFilter !== "all" && pr.reviewDecision !== reviewFilter) return false;
      if (labelFilter !== "all" && !pr.labels.some((label) => label.name === labelFilter)) return false;
      if (query && !pr.title.toLowerCase().includes(query) && !pr.author.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [pullRequests, queueFilter, oldestCreatedAt, creationInterval, ageInterval, testingFilter, scopeFilter, ciFilter, reviewFilter, labelFilter, debouncedSearch]);

  const selectQueueStat = (filter: QueueFilter, oldest?: number, interval?: CreationInterval, newAgeInterval?: AgeInterval) => {
    setCreationInterval(interval);
    setAgeInterval(newAgeInterval);
    setQueueFilter(filter);
    setOldestCreatedAt(oldest);
    setAssigneeFilter("all");
    setTestingFilter("all");
    setScopeFilter("all");
    setCiFilter("all");
    setReviewFilter("all");
    setLabelFilter("all");
    setSearchInput("");
  };

  const selectAssignee = (login: string) => {
    selectQueueStat("assigned");
    setAssigneeFilter(`user:${login}`);
  };

  const sortedPullRequests = useMemo(() => {
    return scopedPullRequests
      .filter(
        (pr) =>
          assigneeFilter === "all" ||
          (assigneeFilter === "unassigned" ? pr.assignees.length === 0 : pr.assignees.some((assignee) => `user:${assignee.login}` === assigneeFilter))
      )
      .sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "number": cmp = a.number - b.number; break;
          case "cvss": {
            const aMax = Math.max(-1, ...a.vulnRefs.map((ref) => ref.cvssScore ?? -1));
            const bMax = Math.max(-1, ...b.vulnRefs.map((ref) => ref.cvssScore ?? -1));
            cmp = aMax - bMax;
            break;
          }
          case "vulnKnownExploited":
            cmp = Number(vulnerabilitySummary(a.vulnRefs).knownExploited) - Number(vulnerabilitySummary(b.vulnRefs).knownExploited);
            break;
          case "vulnCoverage":
            cmp = vulnerabilitySummary(a.vulnRefs).coverage - vulnerabilitySummary(b.vulnRefs).coverage;
            break;
          case "title": cmp = a.title.localeCompare(b.title); break;
          case "author": cmp = a.author.localeCompare(b.author); break;
          case "assignee": cmp = (a.assignees[0]?.login ?? "").localeCompare(b.assignees[0]?.login ?? ""); break;
          case "createdAt": cmp = Date.parse(a.createdAt) - Date.parse(b.createdAt); break;
          case "filesChanged": cmp = a.filesChanged - b.filesChanged; break;
          case "ci": cmp = a.ciStatus.localeCompare(b.ciStatus); break;
          case "review": cmp = a.reviewDecision.localeCompare(b.reviewDecision); break;
          case "area": cmp = Number(a.modules.length > 0) - Number(b.modules.length > 0); break;
          case "testingEnv": cmp = a.testingEnv.localeCompare(b.testingEnv); break;
          case "commentCount": cmp = a.commentCount - b.commentCount; break;
        }
        return sortDirection === "asc" ? cmp : -cmp;
      });
  }, [scopedPullRequests, assigneeFilter, sortField, sortDirection]);

  const assignmentCounts = new Map<string, number>();
  for (const pr of scopedPullRequests) {
    for (const login of new Set(pr.assignees.map((assignee) => assignee.login))) {
      assignmentCounts.set(login, (assignmentCounts.get(login) ?? 0) + 1);
    }
  }
  const unassignedCount = scopedPullRequests.filter((pr) => pr.assignees.length === 0).length;
  const labels = getLabelCounts(pullRequests);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold text-foreground">{`${owner}/${repo} open pull requests`}</h1>
          <Select value={repo} onValueChange={(value) => router.push(`/queue/${value}/`)}>
            <SelectTrigger className="w-[320px]" aria-label="Switch repo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {repos.map((r) => (
                <SelectItem key={r} value={r}>
                  {owner}/{r}
                  {repoPrCounts[r] ? ` (${repoPrCounts[r]})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Generated <time dateTime={generatedAt}>{new Date(generatedAt).toUTCString()}</time>
        </p>
      </div>

      <QueueOverview
        pullRequests={pullRequests}
        onSelect={selectQueueStat}
        selected={queueFilter}
        onSelectAssignee={selectAssignee}
        selectedAssignee={assigneeFilter}
        openDialog={openDialog}
        onOpenDialogChange={setOpenDialog}
      />

      {queueFilter && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm" role="status">
          <span className="rounded-md bg-muted px-3 py-1 font-medium text-foreground">
            {queueFilterLabels[queueFilter]}
            {queueFilter === "created" && creationInterval && `: ${creationInterval.label} (UTC)`}
            {queueFilter === "age" && ageInterval && `: ${ageInterval.label}`}
          </span>
          <button
            type="button"
            onClick={() => {
              setQueueFilter(null);
              setCreationInterval(undefined);
              setAgeInterval(undefined);
              setOldestCreatedAt(undefined);
              // The assignee filter is only coupled to the "assigned" queue filter (set together by
              // selectAssignee); for other queue filters it's an independent selection to leave alone.
              if (queueFilter === "assigned") setAssigneeFilter("all");
            }}
            className="text-primary underline underline-offset-4"
          >
            Clear queue filter
          </button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Select value={scopeFilter} onValueChange={(value) => setScopeFilter(value as ScopeFilter)}>
          <SelectTrigger className="w-[190px]" aria-label="Filter by change scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All change scopes</SelectItem>
            <SelectItem value="research">Module changes</SelectItem>
            <SelectItem value="engineering">Non-module changes</SelectItem>
          </SelectContent>
        </Select>

        <Select value={testingFilter} onValueChange={(value) => setTestingFilter(value as TestingFilter)}>
          <SelectTrigger className="w-[200px]" aria-label="Filter by target environment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All target environments</SelectItem>
            {Object.entries(testingEnvironmentLabels).map(([env, label]) => (
              <SelectItem key={env} value={env}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ciFilter} onValueChange={(value) => setCiFilter(value as CiFilter)}>
          <SelectTrigger className="w-[170px]" aria-label="Filter by CI status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All CI status</SelectItem>
            <SelectItem value="passing">Passing</SelectItem>
            <SelectItem value="failing">Failing</SelectItem>
            <SelectItem value="pending">Pending / unknown</SelectItem>
          </SelectContent>
        </Select>

        <Select value={reviewFilter} onValueChange={(value) => setReviewFilter(value as ReviewFilter)}>
          <SelectTrigger className="w-[190px]" aria-label="Filter by review status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All review status</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="changes_requested">Changes requested</SelectItem>
            <SelectItem value="review_required">Awaiting review</SelectItem>
          </SelectContent>
        </Select>

        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-[220px]" aria-label="Filter by assignee; counts reflect other table filters">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees ({scopedPullRequests.length})</SelectItem>
            <SelectItem value="unassigned">Unassigned ({unassignedCount})</SelectItem>
            {[...assignmentCounts].sort(([a], [b]) => a.localeCompare(b)).map(([login, count]) => (
              <SelectItem key={login} value={`user:${login}`}>
                @{login} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {labels.length > 0 && (
          <Select value={labelFilter} onValueChange={setLabelFilter}>
            <SelectTrigger className="w-[170px]" aria-label="Filter by label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All labels</SelectItem>
              {labels.map(({ name, count }) => (
                <SelectItem key={name} value={name}>
                  {name} ({count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={VULN_SORT_FIELDS.includes(sortField) ? sortField : "default"}
          onValueChange={(value) => {
            setSortField(value === "default" ? "createdAt" : (value as SortField));
            setSortDirection("desc");
          }}
        >
          <SelectTrigger className="w-[190px]" aria-label="Sort by vulnerability evidence">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default order</SelectItem>
            <SelectItem value="cvss">Highest CVSS severity</SelectItem>
            <SelectItem value="vulnKnownExploited">Known exploited first</SelectItem>
            <SelectItem value="vulnCoverage">Scan coverage</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {sortedPullRequests.length} {sortedPullRequests.length === 1 ? "pull request" : "pull requests"}
        </span>
      </div>

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by title or author..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-9" />
        </div>
      </div>

      <PullRequestTable pullRequests={sortedPullRequests} sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
    </div>
  );
}
