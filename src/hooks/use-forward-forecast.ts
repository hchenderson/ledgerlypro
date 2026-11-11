"use client";

import { useMemo } from "react";

import { buildWeeklyNetBand } from "@/forecast/confidence";
import { buildForwardForecast } from "@/forecast/forward-forecast";
import { useAccounts } from "@/hooks/use-accounts";
import { useAuth } from "@/hooks/use-auth";
import { useRecurringTransactions } from "@/hooks/use-recurring-transactions";
import { useAllTransactions } from "@/hooks/use-transactions";

/**
 * Supplies the dashboard and AI narrative with one deterministic forecast.
 * Empty account selection means all accounts, matching the rest of Ledgerly.
 */
export function useForwardForecast(horizonDays = 90) {
  const {
    recurringTransactions,
    recurringOccurrences,
    loading: recurringLoading,
    error: recurringError,
  } = useRecurringTransactions();
  const {
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
  } = useAllTransactions({ respectAccountFilter: false });
  const {
    accounts,
    allAccountsSelected,
    selectedAccountIds,
    primaryAccountId,
    loading: accountsLoading,
    error: accountsError,
  } = useAccounts();
  const { forecastSettings, reportingTimeZone } = useAuth();

  const forecast = useMemo(() => {
    const result = buildForwardForecast({
      transactions,
      recurringTransactions,
      recurringOccurrences,
      accounts,
      primaryAccountId,
      selectedAccountIds: allAccountsSelected ? [] : selectedAccountIds,
      forecastSettings,
      startDate: new Date(),
      horizonDays,
      reportingTimeZone,
    });
    const { p25, p50, p75 } = buildWeeklyNetBand(
      result.historicalActuals,
      result.contract.lookbackWeeks,
      result.contract.start,
    );

    return {
      ...result,
      series: result.series.map((point, index) => {
        const elapsedWeeks = (index + 1) / 7;
        const variabilityScale = Math.sqrt(elapsedWeeks);
        return {
          ...point,
          // The deterministic calculation remains the displayed line. These
          // bounds are only a historical-variability guide, not a confidence
          // interval and not an alternate forecast total.
          cumulativeNet_p50: point.cumulativeNet,
          cumulativeNet_p25:
            point.cumulativeNet + variabilityScale * (p25 - p50),
          cumulativeNet_p75:
            point.cumulativeNet + variabilityScale * (p75 - p50),
        };
      }),
    };
  }, [
    accounts,
    allAccountsSelected,
    forecastSettings,
    horizonDays,
    primaryAccountId,
    recurringTransactions,
    recurringOccurrences,
    reportingTimeZone,
    selectedAccountIds,
    transactions,
  ]);

  return {
    ...forecast,
    loading: transactionsLoading || recurringLoading || accountsLoading,
    error: transactionsError ?? recurringError ?? accountsError,
  };
}
