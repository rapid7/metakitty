"use client";

import { useState } from "react";
import { ChartBar, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MergedByChart } from "@/components/stats/merged-by-chart";
import { MergedByTrendChart } from "@/components/stats/merged-by-trend-chart";
import { MergedByTable } from "@/components/stats/merged-by-table";
import type { MergedByCount } from "@/lib/stats/merged-by";
import type { MergedByTimeSeries } from "@/lib/stats/merged-by-trend";

export interface MergedByLeaderboardSection {
  title: string;
  rows: MergedByCount[];
  trendSeries: MergedByTimeSeries;
}

function MergedByWindowSection({
  title,
  rows,
  trendSeries,
  barLabel,
  itemLabel,
}: {
  title: string;
  rows: MergedByCount[];
  trendSeries: MergedByTimeSeries;
  barLabel?: string;
  itemLabel?: string;
}) {
  const [view, setView] = useState<"ranking" | "trend">("trend");
  const [highlightedLogin, setHighlightedLogin] = useState<string | null>(null);
  if (rows.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <Button type="button" variant="outline" size="sm" aria-pressed={view === "trend"} onClick={() => setView(view === "ranking" ? "trend" : "ranking")}>
          {view === "ranking" ? (
            <>
              <TrendingUp /> View trend
            </>
          ) : (
            <>
              <ChartBar /> View ranking
            </>
          )}
        </Button>
      </div>
      {view === "ranking" ? (
        <MergedByChart rows={rows} highlightedLogin={highlightedLogin} barLabel={barLabel} itemLabel={itemLabel} />
      ) : (
        <MergedByTrendChart series={trendSeries} highlightedLogin={highlightedLogin} />
      )}
      <MergedByTable rows={rows} onLoginHover={setHighlightedLogin} />
    </section>
  );
}

export function MergedByLeaderboards({ sections, barLabel, itemLabel }: { sections: MergedByLeaderboardSection[]; barLabel?: string; itemLabel?: string }) {
  return (
    <>
      {sections.map((section) => (
        <MergedByWindowSection key={section.title} title={section.title} rows={section.rows} trendSeries={section.trendSeries} barLabel={barLabel} itemLabel={itemLabel} />
      ))}
    </>
  );
}
