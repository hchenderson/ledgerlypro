
"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Line } from "recharts"
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig
} from "@/components/ui/chart"

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
  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20 }}>
           <XAxis
            dataKey="name"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            content={<ChartTooltipContent hideIndicator />}
          />
          <Legend content={<ChartLegendContent />} />
          <Bar dataKey="income" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="incomeTrend" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} strokeDasharray="5 5" />
          <Line type="monotone" dataKey="expenseTrend" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} strokeDasharray="5 5"/>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
