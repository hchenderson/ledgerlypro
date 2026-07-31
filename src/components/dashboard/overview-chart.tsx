
"use client"

import { Bar, ComposedChart, XAxis, YAxis, Tooltip, Legend, Line } from "recharts"
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  ChartConfig
} from "@/components/ui/chart"
import { useIsMobile } from "@/hooks/use-mobile"

const chartConfig = {
  income: {
    label: "Income",
    color: "hsl(var(--chart-1))",
  },
  expense: {
    label: "Expense",
    color: "hsl(var(--chart-2))",
  },
  incomeTrend: {
    label: "Income Trend",
    color: "hsl(var(--chart-1))",
  },
  expenseTrend: {
    label: "Expense Trend",
    color: "hsl(var(--chart-2))",
  }
} satisfies ChartConfig

interface OverviewChartProps {
    data: { name: string; income: number; expense: number; incomeTrend?: number, expenseTrend?: number }[];
}

export function OverviewChart({ data }: OverviewChartProps) {
  const isMobile = useIsMobile()
  const compactCurrency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  })
  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })

  return (
    <div className="space-y-3">
      <ChartContainer
        config={chartConfig}
        className="h-[260px] w-full sm:h-[300px]"
        role="img"
        aria-label="Income and expense chart with trend lines"
      >
        <ComposedChart
          data={data}
          margin={{
            top: 20,
            left: isMobile ? -12 : 0,
            right: isMobile ? 2 : 0,
          }}
        >
           <XAxis
            dataKey="name"
            stroke="#888888"
            fontSize={isMobile ? 10 : 12}
            tickLine={false}
            axisLine={false}
            minTickGap={isMobile ? 24 : 8}
          />
          <YAxis
            stroke="#888888"
            fontSize={isMobile ? 10 : 12}
            tickLine={false}
            axisLine={false}
            width={isMobile ? 54 : 64}
            tickFormatter={(value) => compactCurrency.format(Number(value))}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            content={
              <ChartTooltipContent
                className="max-w-[calc(100vw-2rem)]"
                formatter={(value, name) => (
                  <div className="flex min-w-[9rem] items-center justify-between gap-3 sm:min-w-40">
                    <span className="text-muted-foreground">
                      {chartConfig[name as keyof typeof chartConfig]?.label}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      {currency.format(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Legend
            content={
              <ChartLegendContent className="flex-wrap gap-x-3 gap-y-1 text-[10px] sm:text-xs" />
            }
          />
          <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
          {data[0]?.incomeTrend !== undefined && (
            <Line type="monotone" dataKey="incomeTrend" stroke="var(--color-income)" strokeWidth={2} dot={false} strokeDasharray="5 5" legendType={isMobile ? "none" : "line"} />
          )}
          {data[0]?.expenseTrend !== undefined && (
             <Line type="monotone" dataKey="expenseTrend" stroke="var(--color-expense)" strokeWidth={2} dot={false} strokeDasharray="5 5" legendType={isMobile ? "none" : "line"}/>
          )}
        </ComposedChart>
      </ChartContainer>

      <details className="rounded-lg border bg-muted/20 text-sm">
        <summary className="cursor-pointer px-3 py-2 font-medium">
          View chart data
        </summary>
        <div className="max-h-72 overflow-auto border-t">
          <table className="w-full min-w-[22rem] text-left text-xs">
            <thead className="sticky top-0 bg-background">
              <tr>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 text-right font-medium">Income</th>
                <th className="px-3 py-2 text-right font-medium">Expense</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.name} className="border-t">
                  <td className="px-3 py-2">{point.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{currency.format(point.income)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{currency.format(point.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
