"use client";

import { useEffect, useMemo, useRef } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { StableLegend, type StableLegendEntry } from "@/components/stats/stable-legend";
import { pivotCweYearBreakdown, type ModuleCweYearBreakdown } from "@/lib/stats/module-counts";
import { describeCwe } from "@/lib/stats/cwe-names";

// The app's full validated categorical palette (dataviz skill reference palette, see
// globals.css) — fixed hue order, assigned in sequence and never cycled. TOP_N matches its
// length exactly so every legend slot gets its own distinct, CVD-checked color; raising one
// without the other would either waste a validated slot or force two CWEs to share a color.
const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)"];
const TOP_N = SERIES_COLORS.length;
const OTHER_COLOR = "var(--muted-foreground)";
// Sentinel for the "Other" legend entry's own hover — distinct from both real "CWE-<n>" keys and
// OTHER_REST_KEY below, so hovering it highlights the aggregate bucket directly rather than being
// mistaken for an unresolvable CWE id and triggering a (no-op) split.
const OTHER_KEY = "Other";
// Internal row key for "other, minus whatever's been split out below" — distinct from any real
// "CWE-<n>" key, so it can never collide with one when `highlightedCwe` isn't itself one of the
// top slots and needs carving out of the Other bucket (mirrors merged-by-trend-chart.tsx).
const OTHER_REST_KEY = "otherRest";

/**
 * Stacked-by-year breakdown of the top CWEs (by total count across all years), with the long tail
 * collapsed into "Other" — the only way a per-year CWE chart stays legible given how many distinct
 * CWEs show up overall. When `highlightedCwe` names one outside the top slots, its exact per-year
 * counts are split out of "Other" into their own highlighted sub-segment so its actual shape is
 * visible, not just a dimmed "Other" blob it shares with everyone else outside the top slots.
 */
export function ModuleCweYearChart({
  data,
  cweNames,
  highlightedCwe = null,
  onCweHover,
}: {
  data: ModuleCweYearBreakdown[];
  cweNames: Record<string, string>;
  highlightedCwe?: string | null;
  onCweHover?: (cwe: string | null) => void;
}) {
  // Animate in on first mount only — later re-renders (hover dimming, or splitting "Other" out as
  // the mouse moves across the legend/table) shouldn't replay the bars' grow-from-baseline
  // animation, which is what made the chart look like it was glitching on every hover.
  const isFirstRender = useRef(true);
  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  const { rows, seriesKeys, chartConfig, legend } = useMemo(() => {
    const { rows: baseRows, cweKeys } = pivotCweYearBreakdown(data, TOP_N);
    const topSet = new Set(cweKeys);
    const hasOther = baseRows.some((row) => row.Other > 0);
    const splitOther = highlightedCwe !== null && highlightedCwe !== OTHER_KEY && !topSet.has(highlightedCwe);

    const rows = !splitOther
      ? baseRows
      : baseRows.map((row) => {
          const { Other, ...rest } = row;
          const highlightedCount = data.find((d) => d.year === row.year)?.counts.find((c) => c.cwe === highlightedCwe)?.count ?? 0;
          return { ...rest, [OTHER_REST_KEY]: Other - highlightedCount, [highlightedCwe]: highlightedCount };
        });

    const chartConfig: ChartConfig = {};
    cweKeys.forEach((cwe, index) => {
      chartConfig[cwe] = { label: describeCwe(cwe, cweNames[cwe]), color: SERIES_COLORS[index] };
    });
    if (hasOther) chartConfig[OTHER_KEY] = { label: "Other", color: OTHER_COLOR };
    if (splitOther) {
      chartConfig[OTHER_REST_KEY] = { label: "Other", color: OTHER_COLOR };
      chartConfig[highlightedCwe] = { label: describeCwe(highlightedCwe, cweNames[highlightedCwe]), color: OTHER_COLOR };
    }

    const seriesKeys = splitOther ? [...cweKeys, OTHER_REST_KEY, highlightedCwe] : hasOther ? [...cweKeys, OTHER_KEY] : cweKeys;

    // See StableLegend's doc comment — its entries must stay fixed (the top CWEs plus a single
    // "Other") regardless of whether a hover has temporarily split a CWE out of "Other" for the
    // bars/tooltip above.
    const legend: StableLegendEntry[] = cweKeys.map((cwe, index) => ({ key: cwe, color: SERIES_COLORS[index], label: describeCwe(cwe, cweNames[cwe]) }));
    if (hasOther) legend.push({ key: OTHER_KEY, color: OTHER_COLOR, label: "Other" });

    return { rows, seriesKeys, chartConfig, legend };
  }, [data, cweNames, highlightedCwe]);

  if (rows.length === 0) return null;

  return (
    <>
      <ChartContainer config={chartConfig} className="aspect-auto h-[360px] w-full">
        <BarChart data={rows} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="year" />
          <YAxis allowDecimals={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {seriesKeys.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="cwe"
              fill={`var(--color-${key})`}
              fillOpacity={!highlightedCwe || key === highlightedCwe ? 1 : 0.3}
              isAnimationActive={isFirstRender.current}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <StableLegend entries={legend} onHover={onCweHover} />
    </>
  );
}
