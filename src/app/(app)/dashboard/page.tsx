

"use client";

import { Star, Flag } from "lucide-react";
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
import { format, subMonths } from "date-fns";
import dynamic from "next/dynamic";
import {
  useAllTransactions,
  usePriorYearsNet,
  useTransactionData,
} from "@/hooks/use-transactions";
import { EnvelopeSnapshot } from "@/components/dashboard/envelope-snapshot";
import { useEnvelopes } from "@/hooks/use-envelopes";
import { PlaidHealthStrip } from "@/components/plaid/plaid-health-strip";

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
    firstYear,
  } = useAuth();
  const {
    net: priorYearsNet,
    loading: priorYearsSummaryLoading,
  } = usePriorYearsNet(activeYear, firstYear);
  const hasLinkedGoals = rawGoals.some((goal) => goal.linkedCategoryId);
  const {
    transactions: goalTransactions,
    loading: goalTransactionsLoading,
  } = useAllTransactions({ enabled: hasLinkedGoals });
  
  const openingBalanceForYear = useMemo(() => {
    if (userDataLoading || authLoading) return 0;

    return openingBalanceForSelection + priorYearsNet;
  }, [
    authLoading,
    openingBalanceForSelection,
    priorYearsNet,
    userDataLoading,
  ]);

  const analytics = useMemo(() => {
    const referenceDate = new Date(activeYear, new Date().getMonth(), 1);
    return computeDashboardAnalytics(
      transactions,
      openingBalanceForYear,
      referenceDate
    );
  }, [transactions, activeYear, openingBalanceForYear]);

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
    priorYearsSummaryLoading ||
    (hasLinkedGoals && goalTransactionsLoading);

  if (isLoading && transactions.length === 0) {
    return <DashboardSkeleton />;
  }
  
  if (isLoading && transactions.length > 0) {
     // Show skeleton but keep previous data if available
  } else if (isLoading) {
     return <DashboardSkeleton />;
  }

  
  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
  const previousMonthName = subMonths(new Date(), 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <h1 className="sr-only">Dashboard</h1>
      <PlaidHealthStrip transactions={transactions} />
      {(transactions.length === 0 || showInstructions) && <InstructionsGuide />}
      <EnvelopeSnapshot />
      
      {analytics ? (
        <>
           <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            <StatCard
              title="Current Balance"
              value={analytics.currentBalance}
              icon="Wallet"
              trendValue="Your real-time balance"
            />
            {lastUpdatedDate ? (
              <StatCard
                title="Last Updated"
                value={0}
                icon="Activity"
                trendValue={format(lastUpdatedDate, "PPP")}
                isDate
              />
            ) : (
               <StatCard
                title="Last Updated"
                value={0}
                icon="Activity"
                trendValue="No transactions yet"
                isDate
              />
            )}
          </div>

          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Total Income"
              value={analytics.totalIncome}
              icon="TrendingUp"
              trendValue={`All-time income for ${activeYear}`}
              variant="success"
            />
            <StatCard
              title="Total Expenses"
              value={analytics.totalExpenses}
              icon="TrendingDown"
              trendValue={`All-time expenses for ${activeYear}`}
              variant="danger"
            />
             <StatCard
              title="Total Savings"
              value={analytics.totalIncome - analytics.totalExpenses}
              icon="PiggyBank"
              trendValue={`${analytics.totalIncome - analytics.totalExpenses >= 0 ? "You're in the green" : "You're in the red"} for ${activeYear}`}
              variant={analytics.totalIncome - analytics.totalExpenses >= 0 ? 'success' : 'danger'}
            />
          </div>

          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title={`${currentMonthName} Income`}
              value={analytics.currentMonthIncome}
              icon="CalendarClock"
              trendValue="Income this month"
              variant="success"
            />
            <StatCard
              title={`${currentMonthName} Expenses`}
              value={analytics.currentMonthExpenses}
              icon="CalendarClock"
              trendValue="Expenses this month"
              variant="danger"
            />
            <StatCard
              title="Savings Rate"
              value={analytics.savingsRate}
              icon="DollarSign"
              trendValue={`Based on ${activeYear} data`}
              isPercentage
            />
          </div>

           <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              <StatCard
                title={`${previousMonthName} Income`}
                value={analytics.previousMonthIncome}
                icon="CalendarClock"
                trendValue="Income last month"
                variant="success"
              />
              <StatCard
                title={`${previousMonthName} Expenses`}
                value={analytics.previousMonthExpenses}
                icon="CalendarClock"
                trendValue="Expenses last month"
                variant="danger"
              />
            </div>
          
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
            <Card className="min-w-0 overflow-hidden lg:col-span-3">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="break-words">Income vs. Expense ({activeYear})</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
                <OverviewChart data={analytics.overviewData}/>
              </CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden lg:col-span-2">
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
            </Card>
          </div>
        </>
      ): <DashboardSkeleton />}

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2"><Flag className="shrink-0 text-primary" /> <span className="min-w-0">Savings Goals</span></CardTitle>
              <CardDescription>Track your progress towards your financial goals.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
              <GoalProgress goals={goals} />
          </CardContent>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-start gap-2"><Star className="mt-0.5 shrink-0 fill-yellow-400 text-yellow-400" /> <span className="min-w-0 break-words">Favorite Budgets ({activeYear})</span></CardTitle>
              <CardDescription>Your hand-picked budgets for quick insights.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
              <BudgetProgress budgets={favoritedBudgets} />
          </CardContent>
        </Card>
      </div>

       <ForwardAnalyticsPanel />
    </div>
  );
}
