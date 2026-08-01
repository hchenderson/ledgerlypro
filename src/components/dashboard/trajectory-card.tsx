"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";
import { Segmented } from "./forecast-controls";
import { buildWeeklyTrajectory } from "@/forecast/trajectory";
import type { ForecastTx } from "@/forecast/expandRecurringBetween";
import { useIsMobile } from "@/hooks/use-mobile";

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function toChart(points: { weekStart: string; rolling4wk: number }[]) {
  return points.map((p) => ({
    label: format(parseISO(p.weekStart), "MMM d"),
    value: p.rolling4wk,
  }));
}

export function TrajectoryCard({
  actuals,
  givingCategories,
}: {
  actuals: ForecastTx[];
  givingCategories: string[];
}) {
  const [mode, setMode] = useState<"income" | "giving">("income");
  const isMobile = useIsMobile();

  const { chartData, summary } = useMemo(() => {
    const res =
      mode === "income"
        ? buildWeeklyTrajectory(actuals, 26, { type: "income" })
        : buildWeeklyTrajectory(actuals, 26, { type: "income", categories: givingCategories });

    return {
      chartData: toChart(res.points),
      summary: res,
    };
  }, [actuals, mode, givingCategories]);

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-col gap-3 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <CardTitle>{mode === "income" ? "Income Trajectory" : "Giving Trajectory"}</CardTitle>
          <CardDescription>Rolling 4-week average and momentum</CardDescription>
        </div>
        <Segmented
          value={mode}
          onChange={(value) => setMode(value as "income" | "giving")}
          options={[
            { value: "income", label: "Income" },
            { value: "giving", label: "Giving" },
          ]}
          ariaLabel="Trajectory chart view"
        />
      </CardHeader>

      <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
        <div className="mb-3 flex flex-col gap-1 px-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:px-0">
          <span>
            Last 4-week avg: <span className="font-medium tabular-nums text-foreground">{currency.format(summary.last4wkAvg)}</span>
          </span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span>
            Change vs prior 4 weeks:{" "}
            <span className="font-medium tabular-nums text-foreground">{currency.format(summary.delta)}</span>
          </span>
        </div>

        <div
          className="h-60 w-full min-w-0 sm:h-64"
          role="img"
          aria-label={`${mode === "income" ? "Income" : "Giving"} trajectory over the last 26 weeks`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: isMobile ? 2 : 10, left: isMobile ? -16 : 0, bottom: 0 }}
              accessibilityLayer
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                minTickGap={isMobile ? 34 : 24}
                fontSize={isMobile ? 10 : 12}
                tickLine={false}
              />
              <YAxis
                width={isMobile ? 48 : 60}
                fontSize={isMobile ? 10 : 12}
                tickLine={false}
                tickFormatter={(value) => compactNumber.format(Number(value))}
              />
              <Tooltip
                formatter={(value) => currency.format(Number(value))}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  maxWidth: isMobile ? "calc(100vw - 3rem)" : "20rem",
                  fontSize: isMobile ? "0.75rem" : "0.875rem",
                }}
              />
              <Line type="monotone" dataKey="value" dot={false} activeDot={{ r: 6 }} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
