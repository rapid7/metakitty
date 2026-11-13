"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { DaysToLandYear } from "@/lib/stats/days-to-land-by-year";

const chartConfig: ChartConfig = {
  averageDays: { label: "Avg days to land a PR", color: "var(--chart-1)" },
};

export function DaysToLandByYearChart({ data }: { data: DaysToLandYear[] }) {
  if (data.length === 0) return null;
  const rows = data.map((point) => ({ ...point, label: String(point.year) }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[360px] w-full">
      <BarChart data={rows} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" minTickGap={24} />
        <YAxis allowDecimals={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="averageDays" fill="var(--color-averageDays)" radius={2} />
      </BarChart>
    </ChartContainer>
  );
}
