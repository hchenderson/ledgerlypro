
"use client"

import { ComposedChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Area } from "recharts"
import {
  ChartContainer,
  ChartTooltipContent,
  ChartConfig
} from "@/components/ui/chart"
import type { ForecastDataPoint } from "@/lib/forecasting";

const chartConfig = {
  balance: {
    label: "Projected Balance",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

interface ForecastChartProps {
    data: ForecastDataPoint[];
}

export function ForecastChart({ data }: ForecastChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Not enough data to generate a forecast.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
           <XAxis
            dataKey="date"
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
            tickFormatter={(value) => `$${new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value)}`}
            domain={['dataMin - 1000', 'dataMax + 1000']}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            content={<ChartTooltipContent 
                formatter={(value, name) => {
                    if (name === "balance") {
                         return (
                            <div className="flex flex-col">
                                <span className="font-bold">{`$${(value as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                                <span className="text-xs text-muted-foreground">Projected Balance</span>
                            </div>
                         )
                    }
                }}
            />}
          />
          <defs>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-balance)" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="var(--color-balance)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="balance" stroke="var(--color-balance)" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
