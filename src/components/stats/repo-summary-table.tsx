"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { LabelsBadges } from "@/components/badges";
import type { PrSummary, RepoSummary } from "@/lib/stats/repo-summary";
import type { Label } from "@/lib/types";

function toLabels(names: string[]): Label[] {
  return names.map((name) => ({ name, color: "888888" }));
}

function PrList({ prs, emptyText }: { prs: PrSummary[]; emptyText: string }) {
  if (prs.length === 0) return <p className="text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="space-y-2">
      {prs.map((pr) => (
        <li key={pr.number} className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
          <div className="min-w-0">
            <a href={pr.url} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:underline">
              #{pr.number} {pr.title}
            </a>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>@{pr.author}</span>
              <span>{pr.commentCount} comments</span>
              <Badge variant="outline" className={pr.hasReview ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" : "border-amber-500/50 text-amber-600 dark:text-amber-400"}>
                {pr.hasReview ? "Reviewed" : "Needs review"}
              </Badge>
            </div>
            <LabelsBadges labels={toLabels(pr.labels)} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RepoSummaryTable({ repos }: { repos: RepoSummary[] }) {
  return (
    <Accordion type="multiple" className="rounded-md border px-3">
      {repos.map((repo) => (
        <AccordionItem key={repo.repo} value={repo.repo}>
          <AccordionTrigger>
            <span className="flex flex-1 items-baseline justify-between gap-2 pr-2">
              <span className="font-mono">{repo.repo}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {repo.openPrs.length} open · {repo.closedPrs.length} closed
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div>
              <h3 className="mb-2 font-medium text-foreground">Open pull requests</h3>
              <PrList prs={repo.openPrs} emptyText="No open pull requests." />
            </div>
            <div>
              <h3 className="mb-2 font-medium text-foreground">Recently closed</h3>
              <PrList prs={repo.closedPrs.slice(0, 10)} emptyText="No closed pull requests." />
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
