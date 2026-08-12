
"use client"

import * as React from "react"
import { Pie, PieChart, Cell, Tooltip } from "recharts"
import {
  ChartContainer,
  type ChartConfig
} from "@/components/ui/chart"
import { useIsMobile } from "@/hooks/use-mobile"

interface CategoryPieChartProps {
    data: { category: string; amount: number }[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const formattedAmount = new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(data.value);
    
    return (
      <div className="bg-background p-3 border rounded-lg shadow-lg">
        <p className="font-medium text-foreground">{data.payload.name}</p>
        <p className="text-sm text-muted-foreground">
          Amount: {formattedAmount}
        </p>
        <p className="text-sm text-muted-foreground">
          Percentage: {(data.payload.percent * 100).toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};


const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1',
  '#a4de6c', '#d0ed57', '#ffc658'
];

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const isMobile = useIsMobile()
  const chartConfig = React.useMemo(() => {
    return data.reduce((acc, cur, index) => {
      acc[cur.category] = { label: cur.category, color: COLORS[index % COLORS.length] };
      return acc;
    }, {} as ChartConfig);
  }, [data]);
  
  const totalAmount = data.reduce((sum, d) => sum + d.amount, 0);

  const processedData = data.map((item, index) => ({
    name: item.category,
    value: item.amount,
    fill: COLORS[index % COLORS.length],
    percent: totalAmount > 0 ? item.amount / totalAmount : 0
  }));
    
  if (data.length === 0) {
    return (
        <div className="flex h-[260px] items-center justify-center text-muted-foreground sm:h-[350px]">
            No category data to display for the selected filters.
        </div>
    )
  }

  return (
    <div className="space-y-3">
      <ChartContainer
        config={chartConfig}
        className="mx-auto h-[260px] w-full max-w-[350px] sm:h-[350px]"
        role="img"
        aria-label="Category breakdown pie chart"
      >
        <PieChart>
          <Tooltip content={<CustomTooltip />} />
          <Pie
            data={processedData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={isMobile ? 48 : 60}
            outerRadius={isMobile ? 78 : 90}
            paddingAngle={2}
            labelLine={!isMobile}
            label={
              isMobile
                ? false
                : ({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
            }
          >
             {processedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3 sm:hidden">
        {processedData.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: item.fill }}
                aria-hidden="true"
              />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {(item.percent * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <details className="rounded-lg border bg-muted/20 text-sm">
        <summary className="cursor-pointer px-3 py-2 font-medium">
          View category data
        </summary>
        <div className="max-h-72 overflow-auto border-t">
          <table className="w-full min-w-[20rem] text-left text-xs">
            <thead className="sticky top-0 bg-background">
              <tr>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {processedData.map((item) => (
                <tr key={item.name} className="border-t">
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(item.value)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(item.percent * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
