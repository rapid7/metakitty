"use client";

import { useEffect, useRef } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { StableLegend, type StableLegendEntry } from "@/components/stats/stable-legend";
import { OTHER_KEY, type MergedByTimeSeries, type MergedByTimeUnit } from "@/lib/stats/merged-by-trend";

const CATEGORICAL_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const OTHER_COLOR = "var(--muted-foreground)";
const OTHER_REST_KEY = "otherRest";

function bucketLabel(unit: MergedByTimeUnit, iso: string): string {
  const date = new Date(iso);
  switch (unit) {
    case "day":
    case "week":
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    case "month":
      return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    case "quarter":
      return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
  }
}

function sumExcluding(counts: Record<string, number>, excluded: Set<string>): number {
  return Object.entries(counts)
    .filter(([login]) => !excluded.has(login))
    .reduce((sum, [, count]) => sum + count, 0);
}

/**
 * Stacked merge counts over time for the top 5 mergers (within this series' own window) plus
 * "other", mirroring the queue dashboard's per-assignee creation histogram but bucketed by merge
 * date instead of creation date. When `highlightedLogin` falls outside the top 5, their exact counts
 * are split out of "other" into their own highlighted sub-segment so their actual shape is visible,
 * not just a dimmed "other" blob they share with everyone else outside the top 5.
 */
export function MergedByTrendChart({
  series,
  highlightedLogin = null,
  onLoginHover,
}: {
  series: MergedByTimeSeries;
  highlightedLogin?: string | null;
  onLoginHover?: (login: string | null) => void;
}) {
  // Animate in on first mount only — later re-renders (e.g. hover dimming, or splitting "other" out) shouldn't replay the entrance animation.
  const isFirstRender = useRef(true);
  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  const { points, unit, topLogins } = series;
  const hasData = points.some((point) => Object.values(point.counts).some((count) => count > 0));
  if (!hasData) return null;

  const topSet = new Set(topLogins);
  const splitOther = highlightedLogin !== null && highlightedLogin !== OTHER_KEY && !topSet.has(highlightedLogin);

  const seriesKeys = splitOther ? [...topLogins, OTHER_REST_KEY, highlightedLogin] : [...topLogins, OTHER_KEY];
  const chartConfig: ChartConfig = Object.fromEntries(
    seriesKeys.map((key, index) => {
      if (key === OTHER_KEY || key === OTHER_REST_KEY) return [key, { label: "Other", color: OTHER_COLOR }];
      if (splitOther && key === highlightedLogin) return [key, { label: key, color: OTHER_COLOR }];
      return [key, { label: key, color: CATEGORICAL_COLORS[index] }];
    })
  );

  // See StableLegend's doc comment — its entries must stay fixed (the top mergers plus a single
  // "Other") regardless of whether a hover has temporarily split a login out of "Other" for the
  // bars/tooltip above.
  const legend: StableLegendEntry[] = [
    ...topLogins.map((login, index) => ({ key: login, color: CATEGORICAL_COLORS[index], label: login })),
    { key: OTHER_KEY, color: OTHER_COLOR, label: "Other" },
  ];

  const rows = points.map((point) => {
    const named = Object.fromEntries(topLogins.map((login) => [login, point.counts[login] ?? 0]));
    const label = bucketLabel(unit, point.start);
    if (splitOther) {
      const highlightedCount = point.counts[highlightedLogin] ?? 0;
      return { label, ...named, [OTHER_REST_KEY]: sumExcluding(point.counts, topSet) - highlightedCount, [highlightedLogin]: highlightedCount };
    }
    return { label, ...named, [OTHER_KEY]: sumExcluding(point.counts, topSet) };
  });

  return (
    <>
      <ChartContainer config={chartConfig} className="aspect-auto h-[360px] w-full">
        <BarChart data={rows} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" minTickGap={24} />
          <YAxis allowDecimals={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {seriesKeys.map((key) => {
            const fillOpacity = splitOther ? (key === highlightedLogin ? 1 : 0.3) : highlightedLogin && key !== highlightedLogin ? 0.3 : 1;
            return <Bar key={key} dataKey={key} stackId="merged-by" fill={`var(--color-${key})`} fillOpacity={fillOpacity} isAnimationActive={isFirstRender.current} />;
          })}
        </BarChart>
      </ChartContainer>
      <StableLegend entries={legend} onHover={onLoginHover} />
    </>
  );
}
