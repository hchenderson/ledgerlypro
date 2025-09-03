"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { CategoryPieChart } from "@/components/reports/category-pie-chart";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { mockOverviewData } from "@/lib/data";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold tracking-tight font-headline">Financial Reports</h2>
            <p className="text-muted-foreground">
                Your monthly financial overview.
            </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income vs. Expense</CardTitle>
            <CardDescription>A breakdown of your income and expenses over the last few months.</CardDescription>
          </CardHeader>
          <CardContent>
            <OverviewChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>How your spending is distributed across different categories this month.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryPieChart />
          </CardContent>
        </Card>
      </div>
       <Card>
          <CardHeader>
            <CardTitle>Balance Trend</CardTitle>
            <CardDescription>Your account balance over time.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
                config={{
                    balance: {
                    label: "Balance",
                    color: "hsl(var(--chart-1))",
                    },
                }}
                className="h-[300px] w-full"
                >
                <AreaChart
                    accessibilityLayer
                    data={mockOverviewData.map(d => ({...d, balance: d.income - d.expense}))}
                    margin={{
                    left: 12,
                    right: 12,
                    }}
                >
                    <CartesianGrid vertical={false} />
                    <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.slice(0, 3)}
                    />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                    <Area
                    dataKey="balance"
                    type="natural"
                    fill="var(--color-balance)"
                    fillOpacity={0.4}
                    stroke="var(--color-balance)"
                    />
                </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
    </div>
  );
}
