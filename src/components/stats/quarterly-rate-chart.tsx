"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { QuarterlyPoint } from "@/lib/stats/quarterly";

const chartConfig: ChartConfig = {
  opened: { label: "Total opened", color: "var(--chart-1)" },
  closed: { label: "Total closed", color: "var(--chart-2)" },
  rapid7Opened: { label: "Rapid7 opened", color: "var(--chart-3)" },
  rapid7Closed: { label: "Rapid7 closed", color: "var(--chart-4)" },
};

function quarterLabel(iso: string): string {
  const date = new Date(iso);
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${quarter} ${date.getUTCFullYear()}`;
}

export function QuarterlyRateChart({ title, data }: { title: string; data: QuarterlyPoint[] }) {
  const rows = data.map((point) => ({ ...point, label: quarterLabel(point.start) }));
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-foreground">{title}</h2>
      <ChartContainer config={chartConfig} className="aspect-auto h-[360px] w-full">
        <BarChart data={rows} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" minTickGap={24} />
          <YAxis allowDecimals={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="opened" fill="var(--color-opened)" radius={2} />
          <Bar dataKey="closed" fill="var(--color-closed)" radius={2} />
          <Bar dataKey="rapid7Opened" fill="var(--color-rapid7Opened)" radius={2} />
          <Bar dataKey="rapid7Closed" fill="var(--color-rapid7Closed)" radius={2} />
        </BarChart>
      </ChartContainer>
    </section>
  );
}
