
"use client";

import React, { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area } from "recharts";
import { format, parseISO } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function ForecastNetChart({
  data,
  mode = "cumulativeNet",
}: {
  data: any[];
  mode?: "net" | "cumulativeNet";
}) {
  const isMobile = useIsMobile();
  const hasBand = data.length > 0 && data[0].cumulativeNet_p50 !== undefined;

  const chartData = useMemo(
    () =>
      data.map((p) => ({
        ...p,
        label: format(parseISO(p.date), "MMM d"),
        value:
          hasBand && mode === "cumulativeNet"
            ? p.cumulativeNet_p50
            : mode === "net"
              ? p.net
              : p.cumulativeNet,
        band:
          hasBand && mode === "cumulativeNet"
            ? [p.cumulativeNet_p25, p.cumulativeNet_p75]
            : undefined,
      })),
    [data, hasBand, mode]
  );

  const formatTooltipValue = (value: unknown): string => {
    if (typeof value === 'number') {
      return currency.format(value);
    }
    if (Array.isArray(value) && value.length === 2) {
      return `${formatTooltipValue(value[0])} - ${formatTooltipValue(value[1])}`;
    }
    return String(value ?? '');
  }

  if (!chartData.length) {
    return (
      <div className="flex h-60 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground sm:h-64">
        Add recurring activity to see a 90-day forecast.
      </div>
    );
  }

  return (
    <div
      className="h-60 w-full min-w-0 sm:h-64"
      role="img"
      aria-label={`Next 90 days ${mode === "net" ? "daily net" : "cumulative net"} forecast`}
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
            formatter={formatTooltipValue}
            labelStyle={{ marginBottom: '0.5rem' }}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              maxWidth: isMobile ? 'calc(100vw - 3rem)' : '20rem',
              fontSize: isMobile ? '0.75rem' : '0.875rem',
            }}
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
            activeDot={{ r: 6 }}
            strokeWidth={2}
            name={hasBand ? "Median Forecast (p50)" : "Forecast"}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
