
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

const CustomLabelWithLine = ({ cx, cy, midAngle, outerRadius, name, percent, value }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 30; // Increased radius to move labels further out
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    // Starting point of the line on the pie chart
    const lineStartX = cx + (outerRadius + 5) * Math.cos(-midAngle * RADIAN);
    const lineStartY = cy + (outerRadius + 5) * Math.sin(-midAngle * RADIAN);
    
    // Intermediate point for the elbow
    const lineMidX = cx + (outerRadius + 15) * Math.cos(-midAngle * RADIAN);
    const lineMidY = cy + (outerRadius + 15) * Math.sin(-midAngle * RADIAN);

    const lineEndX = x > cx ? x - 5 : x + 5;
    const lineEndY = y;


    // Don't render labels for very small slices to avoid clutter
    if (percent < 0.05) return null;

    const formattedValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

    return (
      <g>
        <path
          d={`M${lineStartX},${lineStartY}L${lineMidX},${lineMidY}L${lineEndX},${lineEndY}`}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1}
          fill="none"
        />
        <text 
          x={lineEndX} 
          y={lineEndY - 8} // Position name above value
          fill="hsl(var(--foreground))" 
          textAnchor={x > cx ? 'start' : 'end'} 
          dominantBaseline="central"
          className="text-xs font-semibold"
        >
          {name}
        </text>
        <text 
          x={lineEndX} 
          y={lineEndY + 8} // Position value below name
          fill="hsl(var(--muted-foreground))"
          textAnchor={x > cx ? 'start' : 'end'} 
          dominantBaseline="central"
          className="text-xs"
        >
          {formattedValue} ({(percent * 100).toFixed(0)}%)
        </text>
      </g>
    );
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
    percent: item.amount / totalAmount
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
        <PieChart margin={{ top: 40, right: 40, bottom: 40, left: 40 }}>
          <Tooltip content={<CustomTooltip />} />
          <Pie
            data={processedData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={60}
            innerRadius={40}
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
