"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MonthlyComparisonPoint } from "@/lib/comparison-analytics";

export type ComparisonMetric = "net" | "income" | "expenses";

interface ComparisonTrendChartProps {
  data: MonthlyComparisonPoint[];
  primaryYear: number;
  comparisonYear: number;
  metric: ComparisonMetric;
  cumulative: boolean;
}

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const metricLabels: Record<ComparisonMetric, string> = {
  net: "Net cash flow",
  income: "Income",
  expenses: "Expenses",
};

export function ComparisonTrendChart({
  data,
  primaryYear,
  comparisonYear,
  metric,
  cumulative,
}: ComparisonTrendChartProps) {
  const suffix = cumulative
    ? (`Cumulative${metric[0].toUpperCase()}${metric.slice(1)}` as const)
    : (`${metric[0].toUpperCase()}${metric.slice(1)}` as const);
  const primaryKey = `primary${suffix}` as keyof MonthlyComparisonPoint;
  const comparisonKey = `comparison${suffix}` as keyof MonthlyComparisonPoint;

  const chartData = data.map((point) => ({
    month: point.month,
    primary: point[primaryKey] as number,
    comparison: point[comparisonKey] as number,
  }));

  const chartConfig = {
    primary: {
      label: `${primaryYear} ${metricLabels[metric]}`,
      color: "hsl(var(--chart-1))",
    },
    comparison: {
      label: `${comparisonYear} ${metricLabels[metric]}`,
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-[320px] w-full">
      <ComposedChart data={chartData} margin={{ left: 4, right: 12, top: 12 }}>
        <defs>
          <linearGradient id="comparison-primary-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.28} />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => compactCurrency.format(Number(value))}
          width={68}
        />
        <ReferenceLine y={0} stroke="hsl(var(--border))" />
        <ChartTooltip
          cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "4 4" }}
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value, name) => (
                <div className="flex min-w-44 items-center justify-between gap-6">
                  <span className="text-muted-foreground">
                    {chartConfig[name as keyof typeof chartConfig]?.label}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {currency.format(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="primary"
          stroke="var(--color-primary)"
          strokeWidth={2.5}
          fill="url(#comparison-primary-fill)"
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="comparison"
          stroke="var(--color-comparison)"
          strokeWidth={2.5}
          strokeDasharray="6 5"
          dot={false}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
