
"use client"

import * as React from "react"
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from "recharts"
import {
  ChartContainer,
  type ChartConfig
} from "@/components/ui/chart"

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
        <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            No expense data to display for the selected filters.
        </div>
    )
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square h-[350px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<CustomTooltip />} />
          <Pie
            data={processedData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            labelLine={true}
            label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
            }
          >
             {processedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
