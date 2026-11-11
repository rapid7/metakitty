"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { MergedByCount } from "@/lib/stats/merged-by";

const TOP_N = 10;
const ROW_HEIGHT = 32;

/** Top-10 rows by count for one window, as a ranked horizontal bar chart, with a "view all" toggle when the window has more rows than that; the full list always stays in the table alongside it. */
export function MergedByChart({
  rows,
  highlightedLogin = null,
  barLabel = "Merged PRs",
  itemLabel = "mergers",
}: {
  rows: MergedByCount[];
  highlightedLogin?: string | null;
  barLabel?: string;
  itemLabel?: string;
}) {
  const chartConfig: ChartConfig = {
    count: { label: barLabel, color: "var(--chart-1)" },
  };
  const [expanded, setExpanded] = useState(false);
  // Animate in on first mount only — later re-renders (e.g. hover dimming) shouldn't replay the entrance animation.
  const isFirstRender = useRef(true);
  useEffect(() => {
    isFirstRender.current = false;
  }, []);
  if (rows.length === 0) return null;

  const isTruncated = rows.length > TOP_N;
  const shownRows = expanded ? rows : rows.slice(0, TOP_N);

  // Expanding to all rows (e.g. the "All time" window's 1,000+ contributors) would otherwise
  // produce a chart tens of thousands of pixels tall — cap the visible height and let it scroll.
  const chartHeight = shownRows.length * ROW_HEIGHT + 24;

  return (
    <div className="mb-3">
      <div className={expanded ? "max-h-96 overflow-y-auto" : undefined}>
        <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
          <BarChart data={shownRows} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis dataKey="login" type="category" width={110} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={isFirstRender.current}>
              <LabelList dataKey="count" position="right" className="fill-foreground" />
              {shownRows.map((row) => (
                <Cell key={row.login} fillOpacity={highlightedLogin && highlightedLogin !== row.login ? 0.3 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
      {isTruncated && (
        <Button variant="link" size="sm" className="px-0" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Show top 10" : `View all ${rows.length} ${itemLabel}`}
        </Button>
      )}
    </div>
  );
}
