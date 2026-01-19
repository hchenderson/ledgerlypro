
"use client";

import { useMemo } from "react";
import { addDays, startOfDay } from "date-fns";
import { useUserData } from "@/hooks/use-user-data";
import { expandRecurringBetween, type ForecastTx, type RecurringTxLike } from "@/forecast/expandRecurringBetween";
import { buildWeeklyProfile, projectWeeklyBaselineEvenDaily } from "@/forecast/baseline";
import { buildForecastSeries } from "@/forecast/series";
import { buildWeeklyNetBand } from "@/forecast/confidence";

// Assumes your Transaction shape includes: id, date, amount, type, category, description
export function useForwardForecast(horizonDays = 90) {
  const { allTransactions, recurringTransactions } = useUserData(); // provided by context

  return useMemo(() => {
    const start = startOfDay(new Date());
    const end = addDays(start, horizonDays);

    const actuals: ForecastTx[] = allTransactions.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      type: t.type,
      category: t.category,
      description: t.description,
      source: "actual",
    }));

    const recurringFuture = expandRecurringBetween(recurringTransactions as RecurringTxLike[], start, end);

    const profile = buildWeeklyProfile(actuals, 13);
    const baseline = projectWeeklyBaselineEvenDaily(profile, start, end);

    // v1 forecast series = recurring certainty + baseline variable expectation
    const forecastTxs = [...recurringFuture, ...baseline];

    const series = buildForecastSeries(forecastTxs, start, end);
    
    // --- Confidence Band Calculation ---
    const { p25, p50, p75 } = buildWeeklyNetBand(actuals, 26);
    const weeklyAverageNet = profile.weeklyIncomeAvg - profile.weeklyExpenseAvg;
    const medianAdjustment = p50 - weeklyAverageNet; // Diff between average (mean) and median

    const seriesWithBand = series.map((point, i) => {
        const daysFromStart = i;
        const weeksFromStart = daysFromStart / 7;

        // Adjust the main cumulative line to be based on the median weekly net (p50) instead of the average.
        const cumulativeMedianAdjustment = weeksFromStart * medianAdjustment;
        const p50CumulativeNet = point.cumulativeNet + cumulativeMedianAdjustment;

        // The deviation of p25 and p75 from the median (p50)
        const p25Offset = p25 - p50;
        const p75Offset = p75 - p50;

        // The uncertainty grows with sqrt of time.
        const bandWidthScalar = Math.sqrt(weeksFromStart);

        return {
            ...point,
            cumulativeNet_p50: p50CumulativeNet,
            cumulativeNet_p25: p50CumulativeNet + bandWidthScalar * p25Offset,
            cumulativeNet_p75: p50CumulativeNet + bandWidthScalar * p75Offset,
        };
    });

    return {
      start,
      end,
      series: seriesWithBand,
      recurringFuture,
      baseline,
      profile,
    };
  }, [allTransactions, recurringTransactions, horizonDays]);
}
