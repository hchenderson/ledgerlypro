
"use client"

import * as React from "react"
import { Pie, PieChart, ResponsiveContainer, Cell } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart"
import type { Transaction } from "@/types"

interface CategoryPieChartProps {
    data: { category: string; amount: number; fill: string }[];
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const chartConfig = data.reduce((acc, cur) => {
    acc[cur.category.toLowerCase()] = { label: cur.category, color: cur.fill }
    return acc
  }, {} as ChartConfig);
    
  if (data.length === 0) {
    return (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No expense data to display.
        </div>
    )
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square h-[300px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={data}
            dataKey="amount"
            nameKey="category"
            innerRadius={60}
          >
             {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <ChartLegend
            content={<ChartLegendContent nameKey="category" />}
            className="-translate-y-[2rem] flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
