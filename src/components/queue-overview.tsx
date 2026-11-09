"use client";

import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getAssignmentStats, getCreationHistogram, getQueueStats } from "@/lib/queue-stats";
import { nonModuleDescription, queueFilterLabels, type CreationInterval, type QueueFilter } from "@/lib/queue-filter";
import { testingEnvironmentLabels } from "@/lib/testing-environment";
import type { PullRequest } from "@/lib/types";

interface Segment {
  filter: QueueFilter;
  label: string;
  count: number;
  color: string;
}

export function QueueOverview({
  pullRequests,
  onSelect,
  selected,
  onSelectAssignee,
  selectedAssignee,
}: {
  pullRequests: PullRequest[];
  onSelect: (filter: QueueFilter, oldestCreatedAt?: number, interval?: CreationInterval) => void;
  selected: QueueFilter | null;
  onSelectAssignee: (login: string) => void;
  selectedAssignee: string;
}) {
  const [histogramOpen, setHistogramOpen] = useState(false);
  const [assigneesOpen, setAssigneesOpen] = useState(false);
  const stats = getQueueStats(pullRequests);
  const assignments = getAssignmentStats(pullRequests);
  const oldestCreatedAt = Math.min(...pullRequests.map((pr) => Date.parse(pr.createdAt)).filter(Number.isFinite));

  const stat = (filter: QueueFilter, text: string, prominent = false, title?: string) => {
    const button = (
      <button
        type="button"
        onClick={() => onSelect(filter, oldestCreatedAt)}
        aria-pressed={selected === filter}
        aria-label={`Show ${queueFilterLabels[filter].toLowerCase()}`}
        className={`rounded-sm text-left underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${selected === filter ? "text-primary underline" : ""} ${prominent ? "text-2xl font-semibold tracking-tight" : ""}`}
      >
        {text}
      </button>
    );
    if (!title) return button;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
    );
  };

  const segment = (filter: QueueFilter, label: string, count: number, color = "bg-primary"): Segment => ({ filter, label, count, color });

  const bars: Record<string, Segment[]> = {
    "Open PRs": [segment("community", "Community", stats.community), segment("rapid7", "Rapid7", stats.rapid7, "bg-sky-500")],
    "Average age": [
      segment("younger", "Under 30 days", stats.total - stats.olderThan30Days),
      segment("aged", "30+ days", stats.olderThan30Days, "bg-amber-500"),
    ],
    Assignments: [segment("assigned", "Assigned", assignments.assigned), segment("unassigned", "Unassigned", assignments.unassigned, "bg-muted-foreground/40")],
    "Change scope": [segment("research", "Module changes", stats.research, "bg-teal-500"), segment("engineering", "Non-module changes", stats.engineering, "bg-violet-500")],
    "CI status": [
      segment("ci-passing", "Passing", stats.ci.passing, "bg-emerald-500"),
      segment("ci-failing", "Failing", stats.ci.failing, "bg-red-500"),
      segment("ci-pending", "Pending / unknown", stats.ci.pending + stats.ci.unknown, "bg-muted-foreground/40"),
    ],
    "Review status": [
      segment("review-approved", "Approved", stats.review.approved, "bg-emerald-500"),
      segment("review-changes-requested", "Changes requested", stats.review.changes_requested, "bg-red-500"),
      segment("review-required", "Awaiting review", stats.review.review_required + stats.review.none, "bg-muted-foreground/40"),
    ],
    "Target environments": (Object.entries(testingEnvironmentLabels) as [QueueFilter, string][]).map(([env, label]) =>
      segment(env, label, stats.testing[env as keyof typeof stats.testing], env === "unknown" ? "bg-muted-foreground/40" : "bg-indigo-500")
    ),
  };

  const cards: Array<{ label: string; popover?: ReactNode; value: ReactNode; detail: ReactNode }> = [
    {
      label: "Open PRs",
      popover: (
        <button type="button" onClick={() => setHistogramOpen(true)} className="rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2">
          Histogram
        </button>
      ),
      value: stat("open", stats.total.toLocaleString(), true),
      detail: (
        <>
          {stat("community", `${stats.community} community`)} · {stat("rapid7", `${stats.rapid7} Rapid7`)}
          <span className="mt-1 block">{stats.authors} contributors</span>
        </>
      ),
    },
    {
      label: "Average age",
      value: <span className="text-2xl font-semibold tracking-tight">{Math.round(stats.averageAge)} days</span>,
      detail: (
        <>
          {stat("aged", `${stats.olderThan30Days} aged 30+ days`)} · {stat("oldest", `Oldest ${Math.floor(stats.oldestAge)} days`)}
        </>
      ),
    },
    {
      label: "Assignments",
      popover: (
        <Popover open={assigneesOpen} onOpenChange={setAssigneesOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2">
              By assignee
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(90vw,20rem)] text-xs">
            <h3 className="font-semibold text-foreground">PRs per assignee</h3>
            <p className="mt-1 text-muted-foreground">
              {assignments.people.length} assignees ·{" "}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => {
                  onSelect("shared");
                  setAssigneesOpen(false);
                }}
              >
                {assignments.shared} shared PRs
              </button>
            </p>
            {assignments.people.length ? (
              <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                {assignments.people.map(({ login, count }) => (
                  <li key={login}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAssignee(login);
                        setAssigneesOpen(false);
                      }}
                      aria-pressed={selected === "assigned" && selectedAssignee === `user:${login}`}
                      className={`flex w-full items-baseline justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-muted ${selected === "assigned" && selectedAssignee === `user:${login}` ? "bg-muted text-primary" : ""}`}
                    >
                      <span className="min-w-0 break-all">@{login}</span>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-muted-foreground">No open PRs.</p>
            )}
          </PopoverContent>
        </Popover>
      ),
      value: (
        <span className="text-sm font-semibold">
          {stat("assigned", `${assignments.assigned} assigned`)} · {stat("unassigned", `${assignments.unassigned} unassigned`)}
        </span>
      ),
      detail: `${assignments.coverage}% assigned`,
    },
    {
      label: "Change scope",
      value: stat("research", `${stats.research} module changes`, true),
      detail: stat("engineering", `${stats.engineering} non-module changes`, false, nonModuleDescription),
    },
    {
      label: "CI status",
      value: stat("ci-passing", `${stats.ci.passing} passing`, true),
      detail: (
        <>
          {stat("ci-failing", `${stats.ci.failing} failing`)} · {stat("ci-pending", `${stats.ci.pending + stats.ci.unknown} pending/unknown`)}
        </>
      ),
    },
    {
      label: "Review status",
      value: stat("review-approved", `${stats.review.approved} approved`, true),
      detail: (
        <>
          {stat("review-changes-requested", `${stats.review.changes_requested} changes requested`)} ·{" "}
          {stat("review-required", `${stats.review.review_required + stats.review.none} awaiting review`)}
        </>
      ),
    },
    {
      label: "Target environments",
      value: stat("docker", `${stats.testing.docker} Docker`, true),
      detail: (
        <>
          {(Object.entries(testingEnvironmentLabels) as [QueueFilter, string][])
            .filter(([env]) => env !== "docker" && stats.testing[env as keyof typeof stats.testing] > 0)
            .map(([env, label], index) => (
              <span key={env}>
                {index > 0 && " · "}
                {stat(env, `${stats.testing[env as keyof typeof stats.testing]} ${label}`)}
              </span>
            ))}
        </>
      ),
    },
  ];

  return (
    <section aria-label="PR queue overview" className="mb-6">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-foreground">Queue overview</h2>
        <p className="text-xs text-muted-foreground">All open pull requests · Independent of table filters · Select a statistic to filter the table</p>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7">
        {cards.map((card) => (
          <div key={card.label} className="flex min-w-0 flex-col rounded-lg border bg-card p-4 text-card-foreground">
            <dt className="flex flex-wrap items-center justify-between gap-1 text-xs font-medium text-muted-foreground">
              <span>{card.label}</span>
              {card.popover}
            </dt>
            <dd className="mt-2 flex flex-1 flex-col">
              <div className="tabular-nums">{card.value}</div>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">{card.detail}</p>
              <div className="mt-auto pt-3">
                <div role="group" aria-label={`${card.label} proportions`} className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                  {bars[card.label]
                    .filter((part) => part.count > 0)
                    .map((part) => {
                      const percentage = stats.total ? (part.count / stats.total) * 100 : 0;
                      const description = `${part.label}: ${part.count} of ${stats.total} open PRs (${Math.round(percentage)}%)`;
                      return (
                        <Tooltip key={part.filter}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={description}
                              aria-pressed={selected === part.filter}
                              onClick={() => onSelect(part.filter, oldestCreatedAt)}
                              style={{ width: `${percentage}%` }}
                              className={`h-full min-w-[2px] ${part.color} hover:brightness-110`}
                            />
                          </TooltipTrigger>
                          <TooltipContent>{description}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                </div>
              </div>
            </dd>
          </div>
        ))}
      </dl>

      <HistogramDialog open={histogramOpen} onOpenChange={setHistogramOpen} pullRequests={pullRequests} onSelect={onSelect} />
    </section>
  );
}

function HistogramDialog({
  open,
  onOpenChange,
  pullRequests,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pullRequests: PullRequest[];
  onSelect: (filter: QueueFilter, oldestCreatedAt?: number, interval?: CreationInterval) => void;
}) {
  const bins = getCreationHistogram(pullRequests);
  const maximum = Math.max(1, ...bins.map((bin) => bin.count));
  const monthFormat = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });
  const label = (bin: (typeof bins)[number]) => {
    const start = monthFormat.format(new Date(bin.start));
    const end = monthFormat.format(new Date(Date.parse(bin.end) - 1));
    return start === end ? start : `${start} – ${end}`;
  };
  const select = (bin: (typeof bins)[number], affiliation?: CreationInterval["affiliation"]) => {
    onSelect("created", undefined, { start: bin.start, end: bin.end, label: label(bin), affiliation });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PR creation dates</DialogTitle>
          <DialogDescription>{pullRequests.length} open PRs grouped by creation date (UTC). Select a bar to filter.</DialogDescription>
        </DialogHeader>
        {bins.length ? (
          <>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-primary" />
                Community
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-sky-500" />
                Rapid7
              </span>
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="flex h-56 items-end gap-1 border-b px-1" style={{ minWidth: bins.length * 42 }}>
                {bins.map((bin) => (
                  <div key={bin.start} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
                    <span className="text-xs tabular-nums">{bin.count}</span>
                    <div className="mx-auto flex w-full max-w-20 shrink-0 flex-col overflow-hidden rounded-t" style={{ height: `${(bin.count / maximum) * 78}%` }}>
                      {(["rapid7", "community"] as const)
                        .filter((affiliation) => bin[affiliation] > 0)
                        .map((affiliation) => {
                          const description = `Show ${bin[affiliation]} ${affiliation === "rapid7" ? "Rapid7" : "community"} open PRs created ${label(bin)} (UTC)`;
                          return (
                            <button
                              key={affiliation}
                              type="button"
                              onClick={() => select(bin, affiliation)}
                              aria-label={description}
                              title={description}
                              className={`min-h-0 cursor-pointer hover:brightness-110 ${affiliation === "rapid7" ? "bg-sky-500" : "bg-primary"}`}
                              style={{ flex: bin[affiliation] }}
                            />
                          );
                        })}
                    </div>
                    <button
                      type="button"
                      onClick={() => select(bin)}
                      aria-label={`Show all ${bin.count} open PRs created ${label(bin)} (UTC)`}
                      className="mt-2 h-9 rounded-sm text-[10px] leading-tight text-muted-foreground hover:text-primary hover:underline"
                    >
                      {label(bin)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-primary">View counts by date</summary>
              <table className="mt-2 w-full text-left tabular-nums">
                <thead>
                  <tr>
                    <th className="py-1">Created</th>
                    <th className="py-1 text-right">Community</th>
                    <th className="py-1 text-right">Rapid7</th>
                    <th className="py-1 text-right">PRs</th>
                  </tr>
                </thead>
                <tbody>
                  {bins.map((bin) => (
                    <tr key={bin.start} className="border-t">
                      <th className="py-1 text-left font-normal">
                        <button type="button" onClick={() => select(bin)} className="text-primary underline underline-offset-2">
                          {label(bin)}
                        </button>
                      </th>
                      <td className="py-1 text-right">{bin.community}</td>
                      <td className="py-1 text-right">{bin.rapid7}</td>
                      <td className="py-1 text-right">{bin.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No open PRs with valid creation dates.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
