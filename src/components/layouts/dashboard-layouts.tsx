"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  WalletCards,
} from "lucide-react";

import { ForecastNetChart } from "@/components/dashboard/forecast-net-chart";
import { RecurringCommitmentsList } from "@/components/dashboard/recurring-commitments-list";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/hooks/use-accounts";
import type { useForwardForecast } from "@/hooks/use-forward-forecast";
import { isRecurringExpectationTransaction } from "@/lib/accounts";
import { allocationsAreComplete } from "@/lib/transaction-allocations";
import {
  isTransactionFinalized,
  isTransactionReviewable,
} from "@/lib/categorization";
import type { DashboardAnalytics } from "@/lib/dashboard-analytics";
import type { LedgerlyLayout } from "@/lib/ui-layout";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

const OverviewChart = dynamic(
  () =>
    import("@/components/dashboard/overview-chart").then(
      (module) => module.OverviewChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full" /> },
);

type ForecastViewModel = ReturnType<typeof useForwardForecast>;

export interface DashboardLayoutsProps {
  layout: LedgerlyLayout;
  analytics: DashboardAnalytics;
  activeYear: number;
  referenceDate: Date;
  allAccountsSelected: boolean;
  lastUpdatedDate: Date | null;
  transactions: Transaction[];
  forecast: ForecastViewModel;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const wholeCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function signedAmount(transaction: Transaction) {
  const incoming =
    transaction.type === "income" ||
    (transaction.type === "transfer" && transaction.transferDirection === "in");
  return `${incoming ? "+" : "−"}${currency.format(transaction.amount)}`;
}

function amountClass(transaction: Transaction) {
  if (transaction.type === "income") return "text-emerald-700";
  if (transaction.type === "transfer") return "text-primary";
  return "text-foreground";
}

function attentionReason(transaction: Transaction) {
  if (isTransactionReviewable(transaction)) return "Category needed";
  if (
    transaction.allocations?.length &&
    !allocationsAreComplete(transaction.amount, transaction.allocations)
  ) {
    return "Split needs review";
  }
  if (transaction.refundStatus === "exception") return "Refund needs review";
  if (transaction.recurringReconciliationStatus === "exception") {
    return "Recurring match needs review";
  }
  return null;
}

function attentionItems(transactions: Transaction[]) {
  return transactions
    .map((transaction) => ({ transaction, reason: attentionReason(transaction) }))
    .filter(
      (
        item,
      ): item is { transaction: Transaction; reason: string } => Boolean(item.reason),
    )
    .slice(0, 8);
}

function PostedCash({
  analytics,
  referenceDate,
  allAccountsSelected,
  compact = false,
}: Pick<
  DashboardLayoutsProps,
  "analytics" | "referenceDate" | "allAccountsSelected"
> & { compact?: boolean }) {
  return (
    <div data-testid="posted-cash" data-value={analytics.currentBalance}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        <WalletCards className="h-4 w-4" /> Posted cash
      </p>
      <p
        className={cn(
          "mt-2 font-code font-semibold leading-none tabular-nums text-[#293A5E] dark:text-foreground",
          compact ? "text-2xl" : "text-4xl sm:text-5xl",
        )}
      >
        {currency.format(analytics.currentBalance)}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {allAccountsSelected ? "All accounts" : "Selected accounts"} · posted
        through {format(referenceDate, "MMM d, yyyy")}
      </p>
    </div>
  );
}

function ForecastSummary({
  forecast,
  chart = false,
  compact = false,
}: {
  forecast: ForecastViewModel;
  chart?: boolean;
  compact?: boolean;
}) {
  return (
    <section
      aria-labelledby="dashboard-outlook-title"
      data-testid="dashboard-outlook"
      data-projected-income={forecast.totals.income}
      data-projected-expenses={forecast.totals.expenses}
      data-projected-net={forecast.totals.net}
      data-projected-ending-balance={forecast.projectedEndingBalance}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Projected
          </p>
          <h2
            id="dashboard-outlook-title"
            className={cn("mt-1 font-semibold", compact ? "text-base" : "text-xl")}
          >
            Current outlook · Next 90 days
          </h2>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" /> Starts {format(forecast.contract.start, "MMM d, yyyy")}
        </p>
      </div>

      {forecast.loading ? (
        <Skeleton className={cn("mt-4 w-full", chart ? "h-72" : "h-44")} />
      ) : (
        <>
          {forecast.error ? (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Forecast data may be incomplete</AlertTitle>
              <AlertDescription>{forecast.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <dl className={cn("divide-y", compact ? "mt-2" : "mt-3")}>
            <div className="flex items-center justify-between gap-3 py-2 text-sm">
              <dt className="text-muted-foreground">Projected income</dt>
              <dd className="font-code font-medium tabular-nums text-emerald-700">
                {wholeCurrency.format(forecast.totals.income)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2 text-sm">
              <dt className="text-muted-foreground">Projected expenses</dt>
              <dd className="font-code font-medium tabular-nums">
                {wholeCurrency.format(forecast.totals.expenses)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2 text-sm font-semibold">
              <dt>Projected net</dt>
              <dd
                className={cn(
                  "font-code tabular-nums",
                  forecast.totals.net >= 0
                    ? "text-emerald-700"
                    : "text-destructive",
                )}
              >
                {forecast.totals.net >= 0 ? "+" : ""}
                {wholeCurrency.format(forecast.totals.net)}
              </dd>
            </div>
          </dl>
          <div className="mt-3 bg-secondary/35 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Projected ending balance
            </p>
            <p className="mt-1 font-code text-2xl font-semibold tabular-nums text-[#293A5E] dark:text-foreground">
              {wholeCurrency.format(forecast.projectedEndingBalance)}
            </p>
          </div>
          {chart ? (
            <div className="mt-5">
              <ForecastNetChart data={forecast.series} mode="cumulativeNet" />
              <p className="mt-2 text-xs text-muted-foreground">
                Dashed-period figures are projections. Transfers affect posted
                balances but are excluded from projected income and expense.
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function RecentMovement({
  transactions,
  title = "Recent movement",
  table = false,
}: {
  transactions: Transaction[];
  title?: string;
  table?: boolean;
}) {
  const { getAccountName } = useAccounts();
  const recent = transactions
    .filter(
      (transaction) =>
        isTransactionFinalized(transaction) &&
        !isRecurringExpectationTransaction(transaction),
    )
    .slice(0, 8);
  return (
    <section aria-labelledby="recent-movement-title">
      <div className="flex items-end justify-between gap-3 border-b pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Posted activity
          </p>
          <h2 id="recent-movement-title" className="mt-1 text-xl font-semibold">
            {title}
          </h2>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/transactions">
            All transactions <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
      {recent.length === 0 ? (
        <p className="border-b py-10 text-center text-sm text-muted-foreground">
          No posted activity in this period.
        </p>
      ) : table ? (
        <>
          <div className="divide-y sm:hidden">
            {recent.map((transaction) => (
              <div
                key={transaction.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {transaction.description}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {format(new Date(transaction.date), "MMM d")} · {attentionReason(transaction) ??
                      (transaction.allocations?.length
                        ? `Split · ${transaction.allocations.length}`
                        : transaction.category)}
                  </p>
                </div>
                <span
                  className={cn(
                    "self-start whitespace-nowrap text-right font-code text-sm font-medium tabular-nums",
                    amountClass(transaction),
                  )}
                >
                  {signedAmount(transaction)}
                </span>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Description</th>
                <th className="px-2 py-2 font-medium">Category</th>
                <th className="px-2 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((transaction) => (
                <tr key={transaction.id} className="h-9 border-b">
                  <td className="whitespace-nowrap px-2 text-xs text-muted-foreground">
                    {format(new Date(transaction.date), "MMM d")}
                  </td>
                  <td className="max-w-60 truncate px-2 font-medium">
                    {transaction.description}
                    <span className="block text-[11px] font-normal text-muted-foreground lg:hidden">
                      {getAccountName(transaction.accountId)}
                    </span>
                  </td>
                  <td className="max-w-52 truncate px-2 text-muted-foreground">
                    {attentionReason(transaction) ??
                      (transaction.allocations?.length
                        ? `Split · ${transaction.allocations.length}`
                        : transaction.category)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-2 text-right font-code font-medium tabular-nums",
                      amountClass(transaction),
                    )}
                  >
                    {signedAmount(transaction)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : (
        <div className="py-4">
          <RecentTransactions transactions={recent} />
        </div>
      )}
    </section>
  );
}

function AttentionList({ transactions, compact = false }: { transactions: Transaction[]; compact?: boolean }) {
  const items = attentionItems(transactions);
  return (
    <section aria-labelledby="dashboard-attention-title">
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            Review
          </p>
          <h2 id="dashboard-attention-title" className={cn("mt-1 font-semibold", compact ? "text-base" : "text-xl")}>
            Exceptions
          </h2>
        </div>
        <Badge variant={items.length > 0 ? "destructive" : "secondary"}>
          {items.length} open
        </Badge>
      </div>
      {items.length > 0 ? (
        <div className="divide-y">
          {items.map(({ transaction, reason }) => (
            <Link
              key={transaction.id}
              href="/transactions/review"
              className="flex min-w-0 items-center gap-3 py-3 outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{transaction.description}</p>
                <p className="truncate text-xs text-muted-foreground">{reason}</p>
              </div>
              <span className="shrink-0 font-code text-xs tabular-nums">
                {signedAmount(transaction)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b py-5 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" /> No supported
          transaction exceptions in this period.
        </div>
      )}
    </section>
  );
}

function ClarifiedDashboard(props: DashboardLayoutsProps) {
  return (
    <div className="space-y-8" data-layout="clarified">
      <section className="grid items-end gap-5 border-y py-7 lg:grid-cols-[1fr_22rem]">
        <PostedCash {...props} />
        <p className="border-l-2 border-primary pl-4 text-sm leading-6 text-muted-foreground">
          Posted cash reflects finalized ledger activity. Forecast figures are
          labeled separately and do not change this balance.
        </p>
      </section>
      <div className="grid gap-8 lg:grid-cols-2">
        <RecentMovement transactions={props.transactions} />
        <ForecastSummary forecast={props.forecast} />
      </div>
      <AttentionList transactions={props.transactions} />
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>Posted income and expense · {props.activeYear}</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pt-5 sm:px-6">
          <OverviewChart data={props.analytics.overviewData} />
        </CardContent>
      </Card>
    </div>
  );
}

function DeskDashboard(props: DashboardLayoutsProps) {
  return (
    <div className="space-y-5" data-layout="bookkeepers-desk">
      <div className="grid grid-cols-2 gap-px border-y bg-border [&>div]:bg-card xl:grid-cols-4">
        <div className="p-4"><PostedCash {...props} compact /></div>
        <div className="p-4">
          <p className="text-xs text-muted-foreground">Money in · current month</p>
          <p className="mt-2 text-right font-code text-xl font-semibold tabular-nums text-emerald-700">{currency.format(props.analytics.currentMonthIncome)}</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-muted-foreground">Money out · current month</p>
          <p className="mt-2 text-right font-code text-xl font-semibold tabular-nums">{currency.format(props.analytics.currentMonthExpenses)}</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-muted-foreground">Projected net · 90 days</p>
          <p className={cn("mt-2 text-right font-code text-xl font-semibold tabular-nums", props.forecast.totals.net >= 0 ? "text-emerald-700" : "text-destructive")}>{props.forecast.totals.net >= 0 ? "+" : ""}{wholeCurrency.format(props.forecast.totals.net)}</p>
        </div>
      </div>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <RecentMovement transactions={props.transactions} table title="Working ledger" />
        <aside className="space-y-6 xl:border-l xl:pl-5">
          <ForecastSummary forecast={props.forecast} compact />
          <section aria-labelledby="desk-commitments-title">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 id="desk-commitments-title" className="font-semibold">Next commitments</h2>
              <span className="text-xs text-muted-foreground">30 days</span>
            </div>
            <div className="mt-3">
              {props.forecast.loading ? <Skeleton className="h-40" /> : <RecurringCommitmentsList recurringFuture={props.forecast.recurringFuture} start={props.forecast.contract.start} />}
            </div>
          </section>
          <AttentionList transactions={props.transactions} compact />
        </aside>
      </div>
    </div>
  );
}

function FinancialBriefDashboard(props: DashboardLayoutsProps) {
  const currentNet =
    props.analytics.currentMonthIncome - props.analytics.currentMonthExpenses;
  const previousNet =
    props.analytics.previousMonthIncome - props.analytics.previousMonthExpenses;
  const netDifference = currentNet - previousNet;
  const Icon = netDifference >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="mx-auto max-w-6xl space-y-9" data-layout="financial-brief">
      <section className="grid items-end gap-8 border-b pb-8 lg:grid-cols-[1fr_22rem]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Cash review · {props.allAccountsSelected ? "All accounts" : "Selected accounts"}
          </p>
          <div className="mt-5"><PostedCash {...props} /></div>
          <p className="mt-5 max-w-3xl font-headline text-lg leading-8 text-[#293A5E] dark:text-foreground sm:text-xl">
            This month’s posted net is <strong>{currency.format(currentNet)}</strong>, {currency.format(Math.abs(netDifference))} {netDifference >= 0 ? "ahead of" : "behind"} the previous month.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-l pl-6 text-sm">
          <div><dt className="text-xs text-muted-foreground">Current-month net</dt><dd className="mt-1 flex items-center gap-1 font-code font-semibold tabular-nums"><Icon className="h-4 w-4" />{currency.format(currentNet)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Previous-month net</dt><dd className="mt-1 font-code font-semibold tabular-nums">{currency.format(previousNet)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Projected net</dt><dd className="mt-1 font-code font-semibold tabular-nums text-emerald-700">{props.forecast.totals.net >= 0 ? "+" : ""}{wholeCurrency.format(props.forecast.totals.net)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">90-day ending</dt><dd className="mt-1 font-code font-semibold tabular-nums">{wholeCurrency.format(props.forecast.projectedEndingBalance)}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="brief-cash-flow-title">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
          <div><h2 id="brief-cash-flow-title" className="text-xl font-semibold">Posted cash flow and current outlook</h2><p className="mt-1 text-sm text-muted-foreground">Actual income and expense stay separate from the projected 90-day net.</p></div>
          <Badge variant="outline" className="max-w-full whitespace-normal text-right">Forecast starts {format(props.forecast.contract.start, "MMM d, yyyy")}</Badge>
        </div>
        <div className="grid gap-8 pt-5 lg:grid-cols-[1.15fr_.85fr]">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Posted actuals</p><OverviewChart data={props.analytics.overviewData} /></div>
          <ForecastSummary forecast={props.forecast} chart />
        </div>
      </section>

      <div className="grid gap-10 border-t pt-8 lg:grid-cols-[1fr_22rem]">
        <RecentMovement transactions={props.transactions} title="Main drivers" />
        <AttentionList transactions={props.transactions} />
      </div>
    </div>
  );
}

export function DashboardLayouts(props: DashboardLayoutsProps) {
  if (props.layout === "bookkeepers-desk") return <DeskDashboard {...props} />;
  if (props.layout === "financial-brief") return <FinancialBriefDashboard {...props} />;
  return <ClarifiedDashboard {...props} />;
}
