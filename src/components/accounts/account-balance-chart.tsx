"use client";

import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export interface AccountBalanceChartPoint {
  date: string;
  label: string;
  balance: number;
}

export function AccountBalanceChart({
  data,
  accountName,
  activeYear,
  isLiability,
}: {
  data: AccountBalanceChartPoint[];
  accountName: string;
  activeYear: number;
  isLiability: boolean;
}) {
  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label={`${accountName} running balance chart for ${activeYear}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 8,
            right: 12,
            bottom: 0,
            left: 0,
          }}
          accessibilityLayer
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            minTickGap={34}
            tickLine={false}
            fontSize={11}
          />
          <YAxis
            tickFormatter={(value) =>
              compactCurrency.format(Number(value))
            }
            tickLine={false}
            fontSize={11}
            width={62}
          />
          <Tooltip
            formatter={(value) => currency.format(Number(value))}
            labelFormatter={(_, payload) =>
              payload?.[0]?.payload?.date
                ? format(
                    new Date(
                      `${payload[0].payload.date}T12:00:00`,
                    ),
                    "MMM d, yyyy",
                  )
                : ""
            }
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.75rem",
            }}
          />
          <Line
            type="monotone"
            dataKey="balance"
            name={isLiability ? "Amount owed" : "Balance"}
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
