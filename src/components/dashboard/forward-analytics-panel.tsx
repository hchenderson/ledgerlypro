"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForwardForecast } from "@/hooks/use-forward-forecast";
import { ForecastNetChart } from "@/components/dashboard/forecast-net-chart";
import { RecurringCommitmentsList } from "@/components/dashboard/recurring-commitments-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactionData } from "@/hooks/use-transactions";
import { useMemo, useState } from "react";
import { Segmented } from "./forecast-controls";
import { TrajectoryCard } from "./trajectory-card";
import type { ForecastTx } from "@/forecast/expandRecurringBetween";
import { expandTransactionsForReporting } from "@/lib/transaction-allocations";

export function ForwardAnalyticsPanel() {
  const {
    transactions: allTransactions,
    loading: userDataLoading,
  } = useTransactionData();
  const { series, recurringFuture } = useForwardForecast(90);
  const isForecastLoading = userDataLoading || !series || !recurringFuture;
  const [chartMode, setChartMode] = useState<'net' | 'cumulativeNet'>('cumulativeNet');

  const actuals: ForecastTx[] = useMemo(
    () =>
      expandTransactionsForReporting(allTransactions)
        .filter(
          (transaction) =>
            transaction.type === "income" ||
            transaction.type === "expense",
        )
        .map((transaction) => ({
          ...transaction,
          amount: Math.abs(transaction.amount),
          type: transaction.type as "income" | "expense",
          source: "actual" as const,
        })),
    [allTransactions],
  );
  const givingCategories = ["Giving", "Tithes", "Offerings", "Donations"];

  return (
    <section className="min-w-0" aria-labelledby="financial-analytics-heading">
      <h2 id="financial-analytics-heading" className="mb-4 font-headline text-xl font-bold tracking-tight sm:text-2xl">
        Financial Analytics
      </h2>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <CardTitle>Next 90 Days Net</CardTitle>
                    <CardDescription>Recurring certainty + category/weekday baseline</CardDescription>
                </div>
                 <Segmented
                    value={chartMode}
                    onChange={(value) => setChartMode(value as 'net' | 'cumulativeNet')}
                    options={[
                        { value: 'cumulativeNet', label: 'Cumulative' },
                        { value: 'net', label: 'Daily Net' },
                    ]}
                    ariaLabel="Net forecast chart view"
                />
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
            {isForecastLoading ? (
              <Skeleton className="h-60 w-full sm:h-64" />
            ) : (
              <ForecastNetChart data={series} mode={chartMode} />
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Recurring Commitments</CardTitle>
            <CardDescription>Upcoming (next 30 days)</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {isForecastLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <RecurringCommitmentsList recurringFuture={recurringFuture} />
            )}
          </CardContent>
        </Card>
        <div className="min-w-0 lg:col-span-2">
            <TrajectoryCard actuals={actuals} givingCategories={givingCategories} />
        </div>
      </div>
    </section>
  );
}
