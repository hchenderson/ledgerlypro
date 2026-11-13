

"use client";

import { Star, Flag, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { BudgetProgress } from "@/components/dashboard/budget-progress";
import { useMemo, type ReactNode } from "react";
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
import { ViewSwitcher } from "@/components/view-switcher";
import { DashboardLayouts } from "@/components/layouts/dashboard-layouts";
import { useForwardForecast } from "@/hooks/use-forward-forecast";
import { isTransactionFinalized } from "@/lib/categorization";

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

function SupplementalDashboard({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: ReactNode;
}) {
  if (!collapsed) {
    return <div className="space-y-5 sm:space-y-6">{children}</div>;
  }

  return (
    <details className="group border-y bg-card px-4 py-3 sm:px-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span>Additional dashboard cards</span>
        <span className="text-xs font-normal text-muted-foreground group-open:hidden">
          Goals, budgets, and saved metrics
        </span>
        <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">
          Hide
        </span>
      </summary>
      <div className="space-y-5 pt-5 sm:space-y-6">{children}</div>
    </details>
  );
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
    allAccountsSelected,
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
    uiLayout,
  } = useAuth();
  const forecast = useForwardForecast(90);
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
    const latestFinalized = transactions.find(isTransactionFinalized);
    return latestFinalized ? new Date(latestFinalized.date) : null;
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
  const showYearTotals = isVisible("total-income") || isVisible("total-expenses") || isVisible("total-savings");
  const showCurrentMonth = isVisible("current-month-income") || isVisible("current-month-expenses") || isVisible("savings-rate");
  const showPreviousMonth = isVisible("previous-month-income") || isVisible("previous-month-expenses");
  const showGoals = isVisible("savings-goals");
  const showBudgets = isVisible("favorite-budgets");
  const dashboardCategoryFilterCount =
    dashboardPreferences.includedCategoryKeys.length +
    dashboardPreferences.excludedCategoryKeys.length;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Cash overview
          </p>
          <h1 className="mt-1 font-headline text-2xl font-bold tracking-tight text-[#293A5E] dark:text-foreground sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lastUpdatedDate
              ? `Posted activity through ${format(lastUpdatedDate, "MMM d, yyyy")}.`
              : `No posted activity for ${activeYear} yet.`}
          </p>
        </div>
        <ViewSwitcher />
      </div>
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
          <DashboardLayouts
            layout={uiLayout}
            analytics={analytics}
            activeYear={activeYear}
            referenceDate={dashboardReferenceDate}
            allAccountsSelected={allAccountsSelected}
            lastUpdatedDate={lastUpdatedDate}
            transactions={transactions}
            forecast={forecast}
          />

          <SupplementalDashboard collapsed={uiLayout !== "clarified"}>
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
          </SupplementalDashboard>
        </>
      ): <DashboardSkeleton />}
    </div>
  );
}
