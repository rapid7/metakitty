"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { SteadyStatePoint } from "@/lib/stats/steady-state";

const chartConfig: ChartConfig = {
  all: { label: "All", color: "var(--chart-1)" },
  rapid7: { label: "Rapid7", color: "var(--chart-2)" },
};

export function SteadyStateChart({ title, data }: { title: string; data: SteadyStatePoint[] }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-foreground">{title} by date</h2>
      <ChartContainer config={chartConfig} className="aspect-auto h-[360px] w-full">
        <AreaChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
            minTickGap={48}
          />
          <YAxis allowDecimals={false} width={40} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(value) => new Date(value as string).toLocaleDateString()} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Area dataKey="all" type="monotone" stroke="var(--color-all)" fill="var(--color-all)" fillOpacity={0.25} strokeWidth={2} />
          <Area dataKey="rapid7" type="monotone" stroke="var(--color-rapid7)" fill="var(--color-rapid7)" fillOpacity={0.25} strokeWidth={2} />
        </AreaChart>
      </ChartContainer>
    </section>
  );
}
