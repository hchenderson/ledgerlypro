"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForwardForecast } from "@/hooks/use-forward-forecast";
import { ForecastNetChart } from "@/components/dashboard/forecast-net-chart";
import { RecurringCommitmentsList } from "@/components/dashboard/recurring-commitments-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { Segmented } from "./forecast-controls";
import { TrajectoryCard } from "./trajectory-card";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useAccounts } from "@/hooks/use-accounts";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function ForwardAnalyticsPanel() {
  const {
    series,
    recurringFuture,
    historicalActuals,
    contract,
    totals,
    openingBalance,
    projectedEndingBalance,
    components,
    diagnostics,
    loading: isForecastLoading,
    error,
  } = useForwardForecast(90);
  const {
    allAccountsSelected,
    selectedAccountIds,
    getAccountName,
  } = useAccounts();
  const [chartMode, setChartMode] = useState<'net' | 'cumulativeNet'>('cumulativeNet');

  const accountScopeLabel = useMemo(
    () => allAccountsSelected
      ? "All accounts"
      : selectedAccountIds.map(getAccountName).join(", "),
    [allAccountsSelected, getAccountName, selectedAccountIds],
  );
  const historicallyEstimated =
    components.merchantEstimated.net +
    components.categoryEstimated.net +
    components.residualEstimated.net;
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
                    <CardDescription>
                      {format(contract.start, "MMM d")}–{format(contract.endInclusive, "MMM d, yyyy")} • {accountScopeLabel}
                    </CardDescription>
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
          <CardContent className="space-y-4 px-2 pb-4 sm:px-6 sm:pb-6">
            {isForecastLoading ? (
              <Skeleton className="h-60 w-full sm:h-64" />
            ) : (
              <>
                {error ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Forecast data may be incomplete</AlertTitle>
                    <AlertDescription>{error.message}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="grid grid-cols-2 gap-2 px-2 text-sm sm:grid-cols-4 sm:px-0">
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">Projected income</p>
                    <p className="font-semibold tabular-nums">{currency.format(totals.income)}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">Projected expenses</p>
                    <p className="font-semibold tabular-nums">{currency.format(totals.expenses)}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">Projected net</p>
                    <p className="font-semibold tabular-nums">{currency.format(totals.net)}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">Projected ending balance</p>
                    <p className="font-semibold tabular-nums">{currency.format(projectedEndingBalance)}</p>
                  </div>
                </div>
                <ForecastNetChart data={series} mode={chartMode} />
                <div className="space-y-1 px-2 text-xs text-muted-foreground sm:px-0">
                  <p>
                    Opening balance {currency.format(openingBalance)}. Scheduled net {currency.format(components.scheduled.net)}; historically estimated net {currency.format(historicallyEstimated)}.
                  </p>
                  <p>
                    Posted activity through {format(new Date(contract.historyEndExclusive.getTime() - 1), "MMM d")} informs estimates. Transfers affect account balances but not projected income or expenses.
                  </p>
                  {diagnostics.fallbackUsed ? (
                    <p>Some activity has insufficient repeat history and uses one residual estimate.</p>
                  ) : null}
                  {diagnostics.recurringOverlapNeedsReview ? (
                    <p>
                      A linked recurring payment changed or was removed. Review recurring reconciliation; the remaining expectation is back in the forecast.
                    </p>
                  ) : null}
                  {diagnostics.excludedReconciledActualLines > 0 ? (
                    <p>
                      {diagnostics.excludedReconciledActualLines} confirmed recurring actual{diagnostics.excludedReconciledActualLines === 1 ? " was" : "s were"} kept in the ledger and excluded from historical estimates to prevent duplicate projections.
                    </p>
                  ) : null}
                </div>
              </>
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
              <RecurringCommitmentsList recurringFuture={recurringFuture} start={contract.start} />
            )}
          </CardContent>
        </Card>
        <div className="min-w-0 lg:col-span-2">
            <TrajectoryCard actuals={historicalActuals} givingCategories={givingCategories} />
        </div>
      </div>
    </section>
  );
}
