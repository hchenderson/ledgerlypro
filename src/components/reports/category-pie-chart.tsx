
"use client"

import * as React from "react"
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from "recharts"
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart"

interface CategoryPieChartProps {
    data: { category: string; amount: number; fill: string }[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-background p-3 border rounded-lg shadow-lg">
        <p className="font-medium text-foreground">{data.payload.name}</p>
        <p className="text-sm text-muted-foreground">
          Amount: {new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD' 
          }).format(data.value)}
        </p>
        <p className="text-sm text-muted-foreground">
          Percentage: {(data.payload.percent * 100).toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

const CustomLabelWithLine = ({ cx, cy, midAngle, outerRadius, name, percent, fill }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    const lineRadius = outerRadius + 10;
    const lineX = cx + lineRadius * Math.cos(-midAngle * RADIAN);
    const lineY = cy + lineRadius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.03) return null;

    return (
      <g>
        <path
          d={`M${lineX},${lineY}L${x > cx ? x - 10 : x + 10},${y}`}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1}
          fill="none"
        />
        <text 
          x={x > cx ? x - 5 : x + 5} 
          y={y - 5} 
          fill="hsl(var(--foreground))" 
          textAnchor={x > cx ? 'start' : 'end'} 
          dominantBaseline="central"
          className="text-xs font-medium"
        >
          {name}
        </text>
        <text 
          x={x > cx ? x - 5 : x + 5} 
          y={y + 8} 
          fill="hsl(var(--muted-foreground))"
          textAnchor={x > cx ? 'start' : 'end'} 
          dominantBaseline="central"
          className="text-xs"
        >
          {(percent * 100).toFixed(0)}%
        </text>
      </g>
    );
  };


export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const chartConfig = React.useMemo(() => {
    return data.reduce((acc, cur) => {
      acc[cur.category] = { label: cur.category, color: cur.fill };
      return acc;
    }, {} as ChartConfig);
  }, [data]);

  const processedData = data.map(item => ({
    name: item.category,
    value: item.amount,
    fill: item.fill,
    percent: item.amount / data.reduce((sum, d) => sum + d.amount, 0)
  }));
    
  if (data.length === 0) {
    return (
        <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            No expense data to display.
        </div>
    )
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square h-[350px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
          <Tooltip content={<CustomTooltip />} />
          <Pie
            data={processedData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            labelLine={false}
            label={<CustomLabelWithLine />}
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
