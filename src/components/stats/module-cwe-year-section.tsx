"use client";

import { useState } from "react";
import { ModuleCweYearChart } from "@/components/stats/module-cwe-year-chart";
import { ModuleCweTable } from "@/components/stats/module-cwe-table";
import type { ModuleCweCount, ModuleCweYearBreakdown } from "@/lib/stats/module-counts";

/** Mirrors merged-by-leaderboards.tsx's section shape (trend chart + scrollable, hoverable counts table) — CWE counts instead of merger details. */
export function ModuleCweYearSection({
  title,
  description,
  data,
  allCounts,
  cweNames,
}: {
  title: string;
  description: string;
  data: ModuleCweYearBreakdown[];
  allCounts: ModuleCweCount[];
  cweNames: Record<string, string>;
}) {
  const [highlightedCwe, setHighlightedCwe] = useState<string | null>(null);
  if (data.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mb-2 text-sm text-muted-foreground">{description}</p>
      <ModuleCweYearChart data={data} cweNames={cweNames} highlightedCwe={highlightedCwe} onCweHover={setHighlightedCwe} />
      <ModuleCweTable rows={allCounts} cweNames={cweNames} onCweHover={setHighlightedCwe} />
    </section>
  );
}
