"use client";

import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";
import type { ForecastPoint } from "@/forecast/series";

export function ForecastNetChart({
  data,
  mode = "cumulativeNet",
}: {
  data: ForecastPoint[];
  mode?: "net" | "cumulativeNet";
}) {
  const chartData = data.map((p) => ({
    ...p,
    label: format(parseISO(p.date), "MMM d"),
    value: mode === "net" ? p.net : p.cumulativeNet,
  }));

  return (
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
  );
}
