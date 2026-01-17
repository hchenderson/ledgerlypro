"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";
import { Segmented } from "./forecast-controls";
import { buildWeeklyTrajectory } from "@/forecast/trajectory";
import type { ForecastTx } from "@/forecast/expandRecurringBetween";

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
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>{mode === "income" ? "Income Trajectory" : "Giving Trajectory"}</CardTitle>
          <CardDescription>Rolling 4-week average and momentum</CardDescription>
        </div>
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as any)}
          options={[
            { value: "income", label: "Income" },
            { value: "giving", label: "Giving" },
          ]}
        />
      </CardHeader>

      <CardContent>
        <div className="mb-3 text-sm text-muted-foreground">
          Last 4-week avg: <span className="font-medium text-foreground">{summary.last4wkAvg.toFixed(2)}</span>{" "}
          · Change vs prior 4 weeks:{" "}
          <span className="font-medium text-foreground">{summary.delta.toFixed(2)}</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" minTickGap={24} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
