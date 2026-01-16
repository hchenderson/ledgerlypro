
"use client";

import { useMemo } from "react";
import { addDays } from "date-fns";
import {
  expandRecurringBetween,
  buildWeeklyProfile,
  projectWeeklyBaseline,
  buildForecastSeries,
} from "@/lib/forecasting";
import { useUserData } from "@/hooks/use-user-data";

export function useForwardForecast(horizonDays = 90) {
  const { allTransactions, recurringTransactions } = useUserData();

  return useMemo(() => {
    const start = new Date();
    const end = addDays(new Date(), horizonDays);

    const actuals = allTransactions.map(t => ({ ...t, source: "actual" as const }));
    const recurringFuture = expandRecurringBetween(recurringTransactions, start, end);

    const profile = buildWeeklyProfile(actuals, 13);
    const baseline = projectWeeklyBaseline(profile, start, end);

    const combined = [...recurringFuture, ...baseline]; // (v1) forecast-only series
    const series = buildForecastSeries(combined, start, end);

    return { series, recurringFuture, baseline, profile };
  }, [allTransactions, recurringTransactions, horizonDays]);
}
