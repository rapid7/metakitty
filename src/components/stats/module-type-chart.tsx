"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { ModuleTypeCount } from "@/lib/stats/module-counts";

// A single measure (module count) split by nominal category (module type) — one series, so one
// hue throughout and no legend box; the bar labels already carry identity.
const chartConfig: ChartConfig = {
  count: { label: "Modules", color: "var(--chart-1)" },
};

export function ModuleTypeChart({ data }: { data: ModuleTypeCount[] }) {
  const rows = [...data].sort((a, b) => b.count - a.count).map((row) => ({ label: row.label, count: row.count }));
  const height = Math.max(160, rows.length * 44);

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-foreground">Modules by type</h2>
      <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
        <BarChart data={rows} layout="vertical" margin={{ left: 12, right: 32 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="label" width={90} tickLine={false} axisLine={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={4} maxBarSize={24} label={{ position: "right", fill: "var(--foreground)", fontSize: 12 }} />
        </BarChart>
      </ChartContainer>
    </section>
  );
}
