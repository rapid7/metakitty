"use client";

import { type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getAgeHistogram, getAssignmentCreationHistogram, getAssignmentStats, getCreationHistogram, getQueueStats } from "@/lib/queue-stats";
import { nonModuleDescription, queueFilterLabels, type AgeInterval, type CreationInterval, type QueueFilter } from "@/lib/queue-filter";
import type { QueueDialogId } from "@/lib/dashboard-filters";
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
  openDialog,
  onOpenDialogChange,
}: {
  pullRequests: PullRequest[];
  onSelect: (filter: QueueFilter, oldestCreatedAt?: number, interval?: CreationInterval, ageInterval?: AgeInterval) => void;
  selected: QueueFilter | null;
  onSelectAssignee: (login: string) => void;
  selectedAssignee: string;
  openDialog: QueueDialogId | null;
  onOpenDialogChange: (dialog: QueueDialogId | null) => void;
}) {
  const histogramOpen = openDialog === "histogram";
  const ageHistogramOpen = openDialog === "age-histogram";
  const byAssigneeOpen = openDialog === "by-assignee";
  const assignmentHistogramOpen = openDialog === "assignment-histogram";
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

  const youngerCount = pullRequests.filter(
    (pr) => Number.isFinite(Date.parse(pr.createdAt)) && Date.now() - Date.parse(pr.createdAt) < 30 * 86_400_000
  ).length;

  const bars: Record<string, Segment[]> = {
    "Open PRs": [segment("community", "Community", stats.community), segment("rapid7", "Rapid7", stats.rapid7, "bg-sky-500")],
    "Average age": [segment("younger", "Under 30 days", youngerCount), segment("aged", "30+ days", stats.olderThan30Days, "bg-amber-500")],
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

  const histogramTrigger = (
    <button type="button" onClick={() => onOpenDialogChange("histogram")} className="rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">
      Histogram
    </button>
  );

  const ageHistogramTrigger = (
    <button type="button" onClick={() => onOpenDialogChange("age-histogram")} className="rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">
      Histogram
    </button>
  );

  const cards: Array<{ label: string; popover?: ReactNode; value: ReactNode; detail: ReactNode }> = [
    {
      label: "Open PRs",
      popover: histogramTrigger,
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
      popover: ageHistogramTrigger,
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
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenDialogChange("assignment-histogram")}
            className="rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Histogram
          </button>
          <button
            type="button"
            onClick={() => onOpenDialogChange("by-assignee")}
            className="rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            By assignee
          </button>
        </span>
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
                <div role="group" aria-label={`${card.label} proportions`} className="flex h-1.5 rounded-full bg-muted">
                  {bars[card.label]
                    .filter((part) => part.count > 0)
                    .map((part, index, parts) => {
                      const percentage = stats.total ? (part.count / stats.total) * 100 : 0;
                      const description = `${part.label}: ${part.count} of ${stats.total} open PRs (${Math.round(percentage)}%)`;
                      return (
                        <Tooltip key={part.filter} delayDuration={150}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={description}
                              aria-pressed={selected === part.filter}
                              onClick={() => onSelect(part.filter, oldestCreatedAt)}
                              style={{ width: `${percentage}%` }}
                              className={`relative h-full min-w-0 ${part.color} ${index === 0 ? "rounded-l-full" : ""} ${index === parts.length - 1 ? "rounded-r-full" : ""} before:absolute before:inset-x-0 before:-inset-y-2 hover:brightness-110 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{description}</p>
                            {part.filter === "engineering" && <p className="mt-1 text-muted-foreground">{nonModuleDescription}</p>}
                            {(part.filter === "community" || part.filter === "rapid7") && (
                              <p className="text-muted-foreground">Rapid7 affiliation inferred from the -r7 author suffix.</p>
                            )}
                            <p className="text-muted-foreground">Click to filter PRs</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                </div>
              </div>
            </dd>
          </div>
        ))}
      </dl>

      <HistogramDialog
        open={histogramOpen}
        onOpenChange={(open) => onOpenDialogChange(open ? "histogram" : null)}
        pullRequests={pullRequests}
        onSelect={onSelect}
      />
      <AgeHistogramDialog
        open={ageHistogramOpen}
        onOpenChange={(open) => onOpenDialogChange(open ? "age-histogram" : null)}
        pullRequests={pullRequests}
        onSelect={onSelect}
      />
      <AssignmentCreationHistogramDialog
        open={assignmentHistogramOpen}
        onOpenChange={(open) => onOpenDialogChange(open ? "assignment-histogram" : null)}
        pullRequests={pullRequests}
        onSelect={onSelect}
        onSelectAssignee={onSelectAssignee}
      />
      <AssigneeBreakdownDialog
        open={byAssigneeOpen}
        onOpenChange={(open) => onOpenDialogChange(open ? "by-assignee" : null)}
        assignments={assignments}
        selected={selected}
        selectedAssignee={selectedAssignee}
        onSelect={onSelect}
        onSelectAssignee={onSelectAssignee}
      />
    </section>
  );
}

// Scales the dialog to fit however many monthly bars it has (each bar tops out at 80px wide
// anyway, so beyond that this just caps out rather than leaving the dialog mostly empty space).
const HISTOGRAM_DIALOG_MIN_WIDTH = 480;
const HISTOGRAM_DIALOG_MAX_WIDTH = 1024;
const HISTOGRAM_DIALOG_WIDTH_PER_BIN = 90;

function histogramDialogWidth(binCount: number) {
  return Math.min(HISTOGRAM_DIALOG_MAX_WIDTH, Math.max(HISTOGRAM_DIALOG_MIN_WIDTH, binCount * HISTOGRAM_DIALOG_WIDTH_PER_BIN));
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
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto" style={{ maxWidth: histogramDialogWidth(bins.length) }}>
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
              <div className="flex h-72 items-end gap-1 border-b px-1" style={{ minWidth: bins.length * 42 }}>
                {bins.map((bin) => (
                  <div key={bin.start} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
                    <span className="text-xs tabular-nums">{bin.count}</span>
                    <div className="mx-auto flex w-full max-w-20 shrink-0 flex-col overflow-hidden rounded-t" style={{ height: `${(bin.count / maximum) * 78}%` }}>
                      {(["rapid7", "community"] as const)
                        .filter((affiliation) => bin[affiliation] > 0)
                        .map((affiliation) => {
                          const description = `Show ${bin[affiliation]} ${affiliation === "rapid7" ? "Rapid7" : "community"} open PRs created ${label(bin)} (UTC)`;
                          return (
                            <Tooltip key={affiliation} delayDuration={150}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => select(bin, affiliation)}
                                  aria-label={description}
                                  className={`min-h-0 cursor-pointer hover:brightness-110 ${affiliation === "rapid7" ? "bg-sky-500" : "bg-primary"}`}
                                  style={{ flex: bin[affiliation] }}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top">{description}</TooltipContent>
                            </Tooltip>
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

function AgeHistogramDialog({
  open,
  onOpenChange,
  pullRequests,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pullRequests: PullRequest[];
  onSelect: (filter: QueueFilter, oldestCreatedAt?: number, interval?: CreationInterval, ageInterval?: AgeInterval) => void;
}) {
  const bins = getAgeHistogram(pullRequests);
  const maximum = Math.max(1, ...bins.map((bin) => bin.count));
  const select = (bin: (typeof bins)[number], affiliation?: AgeInterval["affiliation"]) => {
    onSelect("age", undefined, undefined, { minDays: bin.minDays, maxDays: bin.maxDays, label: bin.label, affiliation });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto" style={{ maxWidth: histogramDialogWidth(bins.length) }}>
        <DialogHeader>
          <DialogTitle>PR age</DialogTitle>
          <DialogDescription>{pullRequests.length} open PRs grouped by days since creation. Select a bar to filter.</DialogDescription>
        </DialogHeader>
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
          <div className="flex h-72 items-end gap-1 border-b px-1" style={{ minWidth: bins.length * 42 }}>
            {bins.map((bin) => (
              <div key={bin.label} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
                <span className="text-xs tabular-nums">{bin.count}</span>
                <div className="mx-auto flex w-full max-w-20 shrink-0 flex-col overflow-hidden rounded-t" style={{ height: `${(bin.count / maximum) * 78}%` }}>
                  {(["rapid7", "community"] as const)
                    .filter((affiliation) => bin[affiliation] > 0)
                    .map((affiliation) => {
                      const description = `Show ${bin[affiliation]} ${affiliation === "rapid7" ? "Rapid7" : "community"} open PRs aged ${bin.label}`;
                      return (
                        <Tooltip key={affiliation} delayDuration={150}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => select(bin, affiliation)}
                              aria-label={description}
                              className={`min-h-0 cursor-pointer hover:brightness-110 ${affiliation === "rapid7" ? "bg-sky-500" : "bg-primary"}`}
                              style={{ flex: bin[affiliation] }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top">{description}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                </div>
                <button
                  type="button"
                  onClick={() => select(bin)}
                  aria-label={`Show all ${bin.count} open PRs aged ${bin.label}`}
                  className="mt-2 h-9 rounded-sm text-[10px] leading-tight text-muted-foreground hover:text-primary hover:underline"
                >
                  {bin.label}
                </button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssigneeBreakdownDialog({
  open,
  onOpenChange,
  assignments,
  selected,
  selectedAssignee,
  onSelect,
  onSelectAssignee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: ReturnType<typeof getAssignmentStats>;
  selected: QueueFilter | null;
  selectedAssignee: string;
  onSelect: (filter: QueueFilter, oldestCreatedAt?: number, interval?: CreationInterval) => void;
  onSelectAssignee: (login: string) => void;
}) {
  const bars = [
    ...assignments.people.map((person) => ({
      key: person.login,
      label: `@${person.login}`,
      count: person.count,
      color: "bg-primary",
      pressed: selected === "assigned" && selectedAssignee === `user:${person.login}`,
      onClick: () => {
        onSelectAssignee(person.login);
        onOpenChange(false);
      },
      description: `Show ${person.count} open PRs assigned to @${person.login}`,
    })),
    ...(assignments.unassigned > 0
      ? [
          {
            key: "unassigned",
            label: "Unassigned",
            count: assignments.unassigned,
            color: "bg-muted-foreground/40",
            pressed: selected === "unassigned",
            onClick: () => {
              onSelect("unassigned");
              onOpenChange(false);
            },
            description: `Show ${assignments.unassigned} open PRs with no assignee`,
          },
        ]
      : []),
  ];
  const maximum = Math.max(1, ...bars.map((bar) => bar.count));
  const total = assignments.assigned + assignments.unassigned;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PRs per assignee</DialogTitle>
          <DialogDescription>
            {total} open PRs grouped by assignee. Select a bar to filter.
            {assignments.shared > 0 && (
              <>
                {" "}
                ·{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => {
                    onSelect("shared");
                    onOpenChange(false);
                  }}
                >
                  {assignments.shared} shared PRs
                </button>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {bars.length ? (
          <ul className="space-y-1.5">
            {bars.map((bar) => (
              <li key={bar.key}>
                <button
                  type="button"
                  onClick={bar.onClick}
                  aria-label={bar.description}
                  aria-pressed={bar.pressed}
                  title={bar.description}
                  className={`flex w-full items-center gap-2 rounded-sm px-1 py-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${bar.pressed ? "bg-muted" : ""}`}
                >
                  <span className="w-32 shrink-0 truncate text-left text-xs text-muted-foreground">{bar.label}</span>
                  <span className="h-4 flex-1 rounded-sm bg-muted">
                    <span className={`block h-full rounded-sm ${bar.color}`} style={{ width: `${(bar.count / maximum) * 100}%` }} />
                  </span>
                  <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums">{bar.count}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No open PRs.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

const ASSIGNEE_SEGMENT_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
  "bg-lime-500",
  "bg-cyan-500",
];

function AssignmentCreationHistogramDialog({
  open,
  onOpenChange,
  pullRequests,
  onSelect,
  onSelectAssignee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pullRequests: PullRequest[];
  onSelect: (filter: QueueFilter, oldestCreatedAt?: number, interval?: CreationInterval) => void;
  onSelectAssignee: (login: string) => void;
}) {
  const { bins, logins } = getAssignmentCreationHistogram(pullRequests);
  const colorFor = (login: string) => ASSIGNEE_SEGMENT_COLORS[logins.indexOf(login) % ASSIGNEE_SEGMENT_COLORS.length];
  const maximum = Math.max(1, ...bins.map((bin) => bin.count));
  const monthFormat = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });
  const label = (bin: (typeof bins)[number]) => {
    const start = monthFormat.format(new Date(bin.start));
    const end = monthFormat.format(new Date(Date.parse(bin.end) - 1));
    return start === end ? start : `${start} – ${end}`;
  };
  const selectMonth = (bin: (typeof bins)[number]) => {
    onSelect("created", undefined, { start: bin.start, end: bin.end, label: label(bin) });
    onOpenChange(false);
  };
  const selectLogin = (login: string) => {
    if (login === "unassigned") onSelect("unassigned");
    else onSelectAssignee(login);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto" style={{ maxWidth: histogramDialogWidth(bins.length) }}>
        <DialogHeader>
          <DialogTitle>Assignments by creation date</DialogTitle>
          <DialogDescription>
            {pullRequests.length} open PRs grouped by creation month (UTC) and assignee. Select a segment to filter.
          </DialogDescription>
        </DialogHeader>
        {bins.length ? (
          <>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {logins.map((login) => (
                <span key={login} className="flex items-center gap-1.5">
                  <span className={`h-3 w-3 rounded-sm ${colorFor(login)}`} />@{login}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-muted-foreground/40" />
                Unassigned
              </span>
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="flex h-72 items-end gap-1 border-b px-1" style={{ minWidth: bins.length * 42 }}>
                {bins.map((bin) => (
                  <div key={bin.start} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
                    <span className="text-xs tabular-nums">{bin.count}</span>
                    <div className="mx-auto flex w-full max-w-20 shrink-0 flex-col overflow-hidden rounded-t" style={{ height: `${(bin.count / maximum) * 78}%` }}>
                      {[...logins, "unassigned"]
                        .filter((login) => (bin.byLogin[login] ?? 0) > 0)
                        .map((login) => {
                          const count = bin.byLogin[login] ?? 0;
                          const description = `Show ${count} open PRs created ${label(bin)} (UTC) assigned to ${login === "unassigned" ? "no one" : `@${login}`}`;
                          return (
                            <Tooltip key={login} delayDuration={150}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => selectLogin(login)}
                                  aria-label={description}
                                  className={`min-h-0 cursor-pointer hover:brightness-110 ${login === "unassigned" ? "bg-muted-foreground/40" : colorFor(login)}`}
                                  style={{ flex: count }}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top">{description}</TooltipContent>
                            </Tooltip>
                          );
                        })}
                    </div>
                    <button
                      type="button"
                      onClick={() => selectMonth(bin)}
                      aria-label={`Show all ${bin.count} open PRs created ${label(bin)} (UTC)`}
                      className="mt-2 h-9 rounded-sm text-[10px] leading-tight text-muted-foreground hover:text-primary hover:underline"
                    >
                      {label(bin)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No open PRs with valid creation dates.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
