
"use client";

import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area } from "recharts";
import { format, parseISO } from "date-fns";
import type { ForecastPoint } from "@/forecast/series";

export function ForecastNetChart({
  data,
  mode = "cumulativeNet",
}: {
  data: any[];
  mode?: "net" | "cumulativeNet";
}) {
  const hasBand = data.length > 0 && data[0].cumulativeNet_p50 !== undefined;

  const chartData = data.map((p) => ({
    ...p,
    label: format(parseISO(p.date), "MMM d"),
    value: hasBand && mode === 'cumulativeNet' ? p.cumulativeNet_p50 : (mode === "net" ? p.net : p.cumulativeNet),
    band: hasBand && mode === 'cumulativeNet' ? [p.cumulativeNet_p25, p.cumulativeNet_p75] : undefined,
  }));

  const formatTooltipValue = (value: unknown): string => {
    if (typeof value === 'number') {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
    }
    if (Array.isArray(value) && value.length === 2) {
      return `${formatTooltipValue(value[0])} - ${formatTooltipValue(value[1])}`;
    }
    return String(value ?? '');
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" minTickGap={24} />
          <YAxis tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value)} />
          <Tooltip 
            formatter={formatTooltipValue}
            labelStyle={{ marginBottom: '0.5rem' }}
            contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
          />
          {hasBand && mode === 'cumulativeNet' && (
            <defs>
                <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
                </linearGradient>
            </defs>
          )}
          {hasBand && mode === 'cumulativeNet' && (
            <Area
              type="monotone"
              dataKey="band"
              stroke="none"
              fill="url(#bandGradient)"
              isAnimationActive={false}
              name="Confidence Band (p25-p75)"
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--chart-1))"
            dot={false}
            strokeWidth={2}
            name={hasBand ? "Median Forecast (p50)" : "Forecast"}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
