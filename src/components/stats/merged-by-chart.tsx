"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { MergedByCount } from "@/lib/stats/merged-by";

const TOP_N = 10;
const ROW_HEIGHT = 32;

const chartConfig: ChartConfig = {
  count: { label: "Merged PRs", color: "var(--chart-1)" },
};

/** Top-10 mergers by count for one window, as a ranked horizontal bar chart, with a "view all" toggle when the window has more mergers than that; the full list always stays in the table alongside it. */
export function MergedByChart({ rows, highlightedLogin = null }: { rows: MergedByCount[]; highlightedLogin?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  // Animate in on first mount only — later re-renders (e.g. hover dimming) shouldn't replay the entrance animation.
  const isFirstRender = useRef(true);
  useEffect(() => {
    isFirstRender.current = false;
  }, []);
  if (rows.length === 0) return null;

  const isTruncated = rows.length > TOP_N;
  const shownRows = expanded ? rows : rows.slice(0, TOP_N);

  return (
    <div className="mb-3">
      <ChartContainer config={chartConfig} className="w-full" style={{ height: shownRows.length * ROW_HEIGHT + 24 }}>
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
      {isTruncated && (
        <Button variant="link" size="sm" className="px-0" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Show top 10" : `View all ${rows.length} mergers`}
        </Button>
      )}
    </div>
  );
}
