

"use client";

import { Star, Flag, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { BudgetProgress } from "@/components/dashboard/budget-progress";
import { useMemo } from "react";
import { useBudgets } from "@/hooks/use-budgets";
import { useCategories } from "@/hooks/use-categories";
import { useGoals } from "@/hooks/use-goals";
import { useAccounts } from "@/hooks/use-accounts";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { InstructionsGuide } from "@/components/dashboard/instructions-guide";
import { computeDashboardAnalytics } from "@/lib/dashboard-analytics";
import { buildProcessedGoals } from "@/lib/goal-progress";
import { GoalProgress } from "@/components/dashboard/goal-progress";
import { endOfYear, format, subMonths } from "date-fns";
import dynamic from "next/dynamic";
import {
  useAllTransactions,
  useTransactionsBeforeYear,
  useTransactionData,
} from "@/hooks/use-transactions";
import { EnvelopeSnapshot } from "@/components/dashboard/envelope-snapshot";
import { useEnvelopes } from "@/hooks/use-envelopes";
import { PlaidHealthStrip } from "@/components/plaid/plaid-health-strip";
import { transactionBalanceDelta } from "@/lib/accounts";
import type { DashboardCardId } from "@/lib/dashboard-preferences";
import { Button } from "@/components/ui/button";

const OverviewChart = dynamic(
  () => import("@/components/dashboard/overview-chart").then((module) => module.OverviewChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[260px] w-full sm:h-[300px]" />,
  }
);

const ForwardAnalyticsPanel = dynamic(
  () =>
    import("@/components/dashboard/forward-analytics-panel").then(
      (module) => module.ForwardAnalyticsPanel
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4" aria-label="Loading financial analytics">
        <Skeleton className="h-8 w-56 max-w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    ),
  }
);

function DashboardSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 sm:h-28" />
        <Skeleton className="h-24 sm:h-28" />
        <Skeleton className="h-24 sm:h-28" />
        <Skeleton className="h-24 sm:h-28" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
        <Skeleton className="h-72 lg:col-span-3 lg:h-80" />
        <Skeleton className="h-64 lg:col-span-2 lg:h-80" />
      </div>
       <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
        <Skeleton className="h-56 lg:col-span-5 lg:h-60" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const {
    goals: rawGoals,
    loading: goalsLoading,
  } = useGoals();
  const {
    budgets,
    getBudgetDetails,
    loading: budgetsLoading,
  } = useBudgets();
  const {
    categories,
    loading: categoriesLoading,
  } = useCategories();
  const {
    openingBalanceForSelection,
    loading: accountsLoading,
  } = useAccounts();
  const {
    getSummaries: getEnvelopeSummaries,
    loading: envelopesLoading,
  } = useEnvelopes();
  const {
    transactions,
    loading: transactionsLoading,
  } = useTransactionData();
  const userDataLoading =
    goalsLoading ||
    budgetsLoading ||
    categoriesLoading ||
    accountsLoading ||
    envelopesLoading ||
    transactionsLoading;
  const {
    showInstructions,
    loading: authLoading,
    activeYear,
    dashboardPreferences,
  } = useAuth();
  const {
    transactions: priorTransactions,
    loading: priorTransactionsLoading,
  } = useTransactionsBeforeYear(activeYear);
  const hasLinkedGoals = rawGoals.some((goal) => goal.linkedCategoryId);
  const {
    transactions: goalTransactions,
    loading: goalTransactionsLoading,
  } = useAllTransactions({ enabled: hasLinkedGoals });
  
  const openingBalanceForYear = useMemo(() => {
    if (userDataLoading || authLoading) return 0;

    return priorTransactions.reduce(
      (balance, transaction) =>
        balance + transactionBalanceDelta(transaction),
      openingBalanceForSelection,
    );
  }, [
    authLoading,
    openingBalanceForSelection,
    priorTransactions,
    userDataLoading,
  ]);

  const analytics = useMemo(() => {
    const now = new Date();
    const referenceDate =
      activeYear === now.getFullYear()
        ? now
        : endOfYear(new Date(activeYear, 0, 1));
    return computeDashboardAnalytics(
      transactions,
      openingBalanceForYear,
      referenceDate,
      referenceDate,
      categories,
      {
        includedCategoryKeys: dashboardPreferences.includedCategoryKeys,
        excludedCategoryKeys: dashboardPreferences.excludedCategoryKeys,
      },
    );
  }, [
    activeYear,
    categories,
    dashboardPreferences.excludedCategoryKeys,
    dashboardPreferences.includedCategoryKeys,
    openingBalanceForYear,
    transactions,
  ]);

  const goals = useMemo(
    () =>
      buildProcessedGoals(
        rawGoals,
        categories,
        hasLinkedGoals ? goalTransactions : transactions,
        userDataLoading,
        new Map(
          getEnvelopeSummaries().map((summary) => [
            summary.envelope.id,
            summary.available,
          ]),
        ),
      ),
    [
      categories,
      goalTransactions,
      getEnvelopeSummaries,
      hasLinkedGoals,
      rawGoals,
      transactions,
      userDataLoading,
    ],
  );

  const favoritedBudgets = useMemo(() => {
    const yearBudgets = budgets.filter(b => b.year === activeYear);
    return getBudgetDetails({
      activeBudgets: yearBudgets,
      transactions: transactions,
      categories: categories,
      forDate: new Date(activeYear, new Date().getMonth(), 1),
    }).filter(b => b.isFavorite);
  }, [getBudgetDetails, budgets, activeYear, transactions, categories]);

  const lastUpdatedDate = useMemo(() => {
    if (transactions.length === 0) return null;
    // Assuming transactions are sorted descending by date
    return new Date(transactions[0].date);
  }, [transactions]);
  
  const isLoading =
    userDataLoading ||
    authLoading ||
    priorTransactionsLoading ||
    (hasLinkedGoals && goalTransactionsLoading);

  if (isLoading && transactions.length === 0) {
    return <DashboardSkeleton />;
  }
  
  if (isLoading && transactions.length > 0) {
     // Show skeleton but keep previous data if available
  } else if (isLoading) {
     return <DashboardSkeleton />;
  }

  
  const dashboardReferenceDate =
    activeYear === new Date().getFullYear()
      ? new Date()
      : endOfYear(new Date(activeYear, 0, 1));
  const currentMonthName = dashboardReferenceDate.toLocaleString('default', { month: 'long' });
  const previousMonthName = subMonths(dashboardReferenceDate, 1).toLocaleString('default', { month: 'long' });
  const isVisible = (cardId: DashboardCardId) =>
    dashboardPreferences.visibleCards.includes(cardId);
  const showBalanceRow = isVisible("balance") || isVisible("last-updated");
  const showYearTotals = isVisible("total-income") || isVisible("total-expenses") || isVisible("total-savings");
  const showCurrentMonth = isVisible("current-month-income") || isVisible("current-month-expenses") || isVisible("savings-rate");
  const showPreviousMonth = isVisible("previous-month-income") || isVisible("previous-month-expenses");
  const showOverview = isVisible("overview-chart");
  const showRecent = isVisible("recent-transactions");
  const showGoals = isVisible("savings-goals");
  const showBudgets = isVisible("favorite-budgets");
  const dashboardCategoryFilterCount =
    dashboardPreferences.includedCategoryKeys.length +
    dashboardPreferences.excludedCategoryKeys.length;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <h1 className="sr-only">Dashboard</h1>
      <PlaidHealthStrip transactions={transactions} />
      {(transactions.length === 0 || showInstructions) && <InstructionsGuide />}
      {dashboardCategoryFilterCount > 0 ? (
        <Card className="border-primary/25 bg-secondary/20">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Dashboard category filters are active</p>
                <p className="text-xs text-muted-foreground">
                  {dashboardCategoryFilterCount} category choice{dashboardCategoryFilterCount === 1 ? "" : "s"} currently affect cash-flow cards and the overview chart. Account balance remains unfiltered.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings">Edit dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {isVisible("envelope-snapshot") ? <EnvelopeSnapshot /> : null}
      
      {analytics ? (
        <>
          {showBalanceRow ? <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            {isVisible("balance") ? <StatCard
              title={activeYear === new Date().getFullYear() ? "Current Balance" : "Ending Balance"}
              value={analytics.currentBalance}
              icon="Wallet"
              trendValue={`Recorded balance through ${format(dashboardReferenceDate, "MMM d, yyyy")}`}
            /> : null}
            {isVisible("last-updated") && lastUpdatedDate ? (
              <StatCard
                title="Last Updated"
                value={0}
                icon="Activity"
                trendValue={format(lastUpdatedDate, "PPP")}
                isDate
              />
            ) : isVisible("last-updated") ? (
              <StatCard
                title="Last Updated"
                value={0}
                icon="Activity"
                trendValue="No transactions yet"
                isDate
              />
            ) : null}
          </div> : null}

          {showYearTotals ? <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isVisible("total-income") ? <StatCard
              title="Total Income"
              value={analytics.totalIncome}
              icon="TrendingUp"
              trendValue={`All-time income for ${activeYear}`}
              variant="success"
            /> : null}
            {isVisible("total-expenses") ? <StatCard
              title="Total Expenses"
              value={analytics.totalExpenses}
              icon="TrendingDown"
              trendValue={`All-time expenses for ${activeYear}`}
              variant="danger"
            /> : null}
            {isVisible("total-savings") ? <StatCard
              title="Total Savings"
              value={analytics.totalIncome - analytics.totalExpenses}
              icon="PiggyBank"
              trendValue={`${analytics.totalIncome - analytics.totalExpenses >= 0 ? "You're in the green" : "You're in the red"} for ${activeYear}`}
              variant={analytics.totalIncome - analytics.totalExpenses >= 0 ? 'success' : 'danger'}
            /> : null}
          </div> : null}

          {showCurrentMonth ? <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isVisible("current-month-income") ? <StatCard
              title={`${currentMonthName} Income`}
              value={analytics.currentMonthIncome}
              icon="CalendarClock"
              trendValue="Income this month"
              variant="success"
            /> : null}
            {isVisible("current-month-expenses") ? <StatCard
              title={`${currentMonthName} Expenses`}
              value={analytics.currentMonthExpenses}
              icon="CalendarClock"
              trendValue="Expenses this month"
              variant="danger"
            /> : null}
            {isVisible("savings-rate") ? <StatCard
              title="Savings Rate"
              value={analytics.savingsRate}
              icon="DollarSign"
              trendValue={`Based on ${activeYear} data`}
              isPercentage
            /> : null}
          </div> : null}

          {showPreviousMonth ? <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              {isVisible("previous-month-income") ? <StatCard
                title={`${previousMonthName} Income`}
                value={analytics.previousMonthIncome}
                icon="CalendarClock"
                trendValue="Income last month"
                variant="success"
              /> : null}
              {isVisible("previous-month-expenses") ? <StatCard
                title={`${previousMonthName} Expenses`}
                value={analytics.previousMonthExpenses}
                icon="CalendarClock"
                trendValue="Expenses last month"
                variant="danger"
              /> : null}
            </div> : null}
          
          {showOverview || showRecent ? <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
            {showOverview ? <Card className={`min-w-0 overflow-hidden ${showRecent ? "lg:col-span-3" : "lg:col-span-5"}`}>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="break-words">Income vs. Expense ({activeYear})</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
                <OverviewChart data={analytics.overviewData}/>
              </CardContent>
            </Card> : null}
            {showRecent ? <Card className={`min-w-0 overflow-hidden ${showOverview ? "lg:col-span-2" : "lg:col-span-5"}`}>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="break-words">Recent Transactions ({activeYear})</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                {transactions.length > 0 ? (
                    <RecentTransactions transactions={transactions.slice(0, 5)} />
                ) : (
                    <div className="flex min-h-40 flex-col items-center justify-center text-center">
                        <p className="text-muted-foreground">No transactions yet for {activeYear}.</p>
                        <p className="text-sm text-muted-foreground">Add your first transaction to get started.</p>
                    </div>
                )}
              </CardContent>
            </Card> : null}
          </div> : null}
        </>
      ): <DashboardSkeleton />}

      {showGoals || showBudgets ? <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        {showGoals ? <Card className={`min-w-0 overflow-hidden ${showBudgets ? "" : "lg:col-span-2"}`}>
          <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2"><Flag className="shrink-0 text-primary" /> <span className="min-w-0">Savings Goals</span></CardTitle>
              <CardDescription>Track your progress towards your financial goals.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
              <GoalProgress goals={goals} />
          </CardContent>
        </Card> : null}
        {showBudgets ? <Card className={`min-w-0 overflow-hidden ${showGoals ? "" : "lg:col-span-2"}`}>
          <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-start gap-2"><Star className="mt-0.5 shrink-0 fill-yellow-400 text-yellow-400" /> <span className="min-w-0 break-words">Favorite Budgets ({activeYear})</span></CardTitle>
              <CardDescription>Your hand-picked budgets for quick insights.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
              <BudgetProgress budgets={favoritedBudgets} />
          </CardContent>
        </Card> : null}
      </div> : null}

      {isVisible("forward-analytics") ? <ForwardAnalyticsPanel /> : null}
    </div>
  );
}
