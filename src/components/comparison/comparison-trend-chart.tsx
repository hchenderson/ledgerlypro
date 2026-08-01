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
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
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
    <div className="space-y-3">
      <ChartContainer
        config={chartConfig}
        className="h-[260px] w-full sm:h-[320px]"
        role="img"
        aria-label={`${cumulative ? "Cumulative" : "Monthly"} ${metricLabels[metric]} comparison chart for ${primaryYear} and ${comparisonYear}`}
      >
        <ComposedChart
          data={chartData}
          margin={{
            left: isMobile ? -12 : 4,
            right: isMobile ? 4 : 12,
            top: 12,
          }}
        >
          <defs>
            <linearGradient id="comparison-primary-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.28} />
              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            interval={isMobile && chartData.length > 6 ? 1 : 0}
            fontSize={isMobile ? 10 : 12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => compactCurrency.format(Number(value))}
            width={isMobile ? 54 : 68}
            fontSize={isMobile ? 10 : 12}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" />
          <ChartTooltip
            cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "4 4" }}
            content={
              <ChartTooltipContent
                indicator="line"
                className="max-w-[calc(100vw-2rem)]"
                formatter={(value, name) => (
                  <div className="flex min-w-[10rem] items-center justify-between gap-3 sm:min-w-44 sm:gap-6">
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
            activeDot={{ r: isMobile ? 7 : 5 }}
          />
          <Line
            type="monotone"
            dataKey="comparison"
            stroke="var(--color-comparison)"
            strokeWidth={2.5}
            strokeDasharray="6 5"
            dot={false}
            activeDot={{ r: isMobile ? 7 : 5 }}
          />
        </ComposedChart>
      </ChartContainer>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 bg-primary" aria-hidden="true" />
          {primaryYear}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 border-t-2 border-dashed border-brand-navy" aria-hidden="true" />
          {comparisonYear}
        </span>
      </div>

      <details className="rounded-lg border bg-muted/20 text-sm">
        <summary className="cursor-pointer px-3 py-2 font-medium">
          View chart data
        </summary>
        <div className="max-h-72 overflow-auto border-t">
          <table className="w-full min-w-[28rem] text-left text-xs">
            <thead className="sticky top-0 bg-background">
              <tr>
                <th className="px-3 py-2 font-medium">Month</th>
                <th className="px-3 py-2 text-right font-medium">{primaryYear}</th>
                <th className="px-3 py-2 text-right font-medium">{comparisonYear}</th>
                <th className="px-3 py-2 text-right font-medium">Difference</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((point) => (
                <tr key={point.month} className="border-t">
                  <td className="px-3 py-2">{point.month}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{currency.format(point.primary)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{currency.format(point.comparison)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{currency.format(point.primary - point.comparison)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
