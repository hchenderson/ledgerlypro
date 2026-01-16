"use client";

import { useMemo } from "react";
import { addDays, startOfDay } from "date-fns";
import { useUserData } from "@/hooks/use-user-data";
import { expandRecurringBetween, type ForecastTx } from "@/forecast/expandRecurringBetween";
import { buildWeeklyProfile, projectWeeklyBaselineEvenDaily } from "@/forecast/baseline";
import { buildForecastSeries } from "@/forecast/series";

// Assumes your Transaction shape includes: id, date, amount, type, category, description
export function useForwardForecast(horizonDays = 90) {
  const { allTransactions, recurringTransactions } = useUserData(); // provided by context:contentReference[oaicite:3]{index=3}

  return useMemo(() => {
    const start = startOfDay(new Date());
    const end = addDays(start, horizonDays);

    const actuals: ForecastTx[] = (allTransactions as any[]).map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      type: t.type,
      category: t.category,
      description: t.description,
      source: "actual",
    }));

    const recurringFuture = expandRecurringBetween(recurringTransactions as any, start, end);

    const profile = buildWeeklyProfile(actuals, 13);
    const baseline = projectWeeklyBaselineEvenDaily(profile, start, end);

    // v1 forecast series = recurring certainty + baseline variable expectation
    const forecastTxs = [...recurringFuture, ...baseline];

    const series = buildForecastSeries(forecastTxs, start, end);

    return {
      start,
      end,
      series,
      recurringFuture,
      baseline,
      profile,
    };
  }, [allTransactions, recurringTransactions, horizonDays]);
}
