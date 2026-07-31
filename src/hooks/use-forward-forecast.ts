
"use client";

import { useMemo } from "react";
import { addDays, startOfDay } from "date-fns";
import { useCategories } from "@/hooks/use-categories";
import { useRecurringTransactions } from "@/hooks/use-recurring-transactions";
import { useTransactionData } from "@/hooks/use-transactions";
import { expandRecurringBetween, type ForecastTx, type RecurringTxLike } from "@/forecast/expandRecurringBetween";
import { buildForecastSeries } from "@/forecast/series";
import { buildWeeklyNetBand } from "@/forecast/confidence";
import { useAuth } from "./use-auth";
import { buildCategoryWeekdayProfile, projectCategoryWeekdayBaseline } from "@/forecast/baseline-category-weekday";
import { buildMerchantProfile } from "@/forecast/merchant-profile";
import { projectMerchantBaseline } from "@/forecast/merchant-project";
import type { Category, SubCategory, Transaction } from "@/types";
import { useAccounts } from "@/hooks/use-accounts";


// Assumes your Transaction shape includes: id, date, amount, type, category, description
export function useForwardForecast(horizonDays = 90) {
  const { recurringTransactions } = useRecurringTransactions();
  const { categories: allCategoriesFromUserData } = useCategories();
  const { transactions: allTransactions } = useTransactionData();
  const {
    allAccountsSelected,
    selectedAccountIds,
    primaryAccountId,
  } = useAccounts();
  const { forecastSettings } = useAuth();

  return useMemo(() => {
    const start = startOfDay(new Date());
    const end = addDays(start, horizonDays);

    const actuals: ForecastTx[] = allTransactions
      .filter(
        (
          transaction,
        ): transaction is Transaction & {
          type: "income" | "expense";
        } =>
          transaction.type === "income" ||
          transaction.type === "expense",
      )
      .map((t) => ({
      id: t.id,
      date: t.date,
      amount: Math.abs(t.amount),
      type: t.type,
      category: t.category,
      description: t.description,
      source: "actual",
      }));

    const visibleRecurringTransactions = allAccountsSelected
      ? recurringTransactions
      : recurringTransactions.filter((schedule) =>
          selectedAccountIds.includes(
            schedule.accountId ?? primaryAccountId ?? "",
          ),
        );
    const recurringFuture = expandRecurringBetween(
      visibleRecurringTransactions as RecurringTxLike[],
      start,
      end,
    );
    
    // --- START NEW HYBRID LOGIC ---
    const baselineExclusions = forecastSettings.baselineExclusions ?? {};

    // 1. Merchant-first baseline
    const merchantProfile = buildMerchantProfile(actuals, 26, 4, { baselineExclusions });
    const merchantBaseline = projectMerchantBaseline(merchantProfile, start, end);

    // 2. Category baseline as fallback
    const merchantDominantCategories = new Set(
      Object.values(merchantProfile.merchants).map(m => m.category)
    );

    const allCategoryNames = new Set<string>();
    const recurseCats = (cats: (Category | SubCategory)[]) => {
        if (!cats) return;
        cats.forEach(c => {
            allCategoryNames.add(c.name);
            if (c.subCategories) {
                recurseCats(c.subCategories);
            }
        })
    };
    recurseCats(allCategoriesFromUserData);

    const categoryBaselineInclusions = Array.from(allCategoryNames).filter(catName => 
        !merchantDominantCategories.has(catName) &&
        !(baselineExclusions.categories?.includes(catName))
    );

    const catProfile = buildCategoryWeekdayProfile(actuals, 13, 4);
    const catBaseline = projectCategoryWeekdayBaseline(catProfile, start, end, {
      includeCategories: categoryBaselineInclusions,
    });
    
    // 3. Combine baselines
    const baseline = [...merchantBaseline, ...catBaseline];
    // --- END NEW HYBRID LOGIC ---


    // v1 forecast series = recurring certainty + baseline variable expectation
    const forecastTxs = [...recurringFuture, ...baseline];

    const series = buildForecastSeries(forecastTxs, start, end);
    
    // --- Confidence Band Calculation ---
    const { p25, p50, p75, weeklyNetSamples } = buildWeeklyNetBand(actuals, 26);
    
    const weeklyAverageNet = weeklyNetSamples.length > 0 ? weeklyNetSamples.reduce((a, b) => a + b, 0) / weeklyNetSamples.length : 0;
    const medianAdjustment = p50 - weeklyAverageNet; // Diff between historical mean and historical median

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
    };
  }, [
    allAccountsSelected,
    allCategoriesFromUserData,
    allTransactions,
    forecastSettings,
    horizonDays,
    primaryAccountId,
    recurringTransactions,
    selectedAccountIds,
  ]);
}
