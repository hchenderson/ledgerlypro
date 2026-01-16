

"use client";

import { DollarSign, TrendingUp, TrendingDown, Wallet, Target, CalendarClock, Star, Flag, Activity, PiggyBank, Rocket, Repeat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { BudgetProgress } from "@/components/dashboard/budget-progress";
import { useEffect, useMemo, useState } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { InstructionsGuide } from "@/components/dashboard/instructions-guide";
import { getDashboardAnalytics } from "@/ai/flows/get-dashboard-analytics-flow";
import type { GetDashboardAnalyticsOutput } from "@/ai/flows/get-dashboard-analytics-flow";
import { GoalProgress } from "@/components/dashboard/goal-progress";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, subMonths, parseISO } from "date-fns";
import { AdBanner } from "@/components/ad-banner";
import { ForwardAnalyticsPanel } from "@/components/dashboard/forward-analytics-panel";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Skeleton className="lg:col-span-3 h-80" />
        <Skeleton className="lg:col-span-2 h-80" />
      </div>
       <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Skeleton className="lg:col-span-5 h-60" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { allTransactions, transactions, loading: userDataLoading, getBudgetDetails, goals, budgets, categories, startingBalance, recurringTransactions } = useUserData();
  const { user, showInstructions, loading: authLoading, activeYear, firstYear } = useAuth();
  const [analytics, setAnalytics] = useState<GetDashboardAnalyticsOutput | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  
  const openingBalanceForYear = useMemo(() => {
    if (userDataLoading || authLoading) return 0;

    const priorTransactions = allTransactions.filter(t => {
        const year = new Date(t.date).getFullYear();
        return year < activeYear;
    });

    if (priorTransactions.length === 0) {
        return startingBalance;
    }

    const netDelta = priorTransactions.reduce((sum, t) => {
        return t.type === 'income'
            ? sum + t.amount
            : sum - t.amount;
    }, 0);

    return startingBalance + netDelta;
  }, [allTransactions, startingBalance, activeYear, userDataLoading, authLoading]);

  useEffect(() => {
    if (!userDataLoading && !authLoading && user) {
      const fetchAnalytics = async () => {
        setIsAnalyticsLoading(true);

        // Filter transactions for the active year before sending to analytics
        const yearTransactions = allTransactions.filter(t => new Date(t.date).getFullYear() === activeYear);

        getDashboardAnalytics({ transactions: yearTransactions, startingBalanceForYear: openingBalanceForYear })
          .then(setAnalytics)
          .finally(() => setIsAnalyticsLoading(false));
      }
      fetchAnalytics();
    }
  }, [allTransactions, userDataLoading, authLoading, user, activeYear, openingBalanceForYear]);

  const favoritedBudgets = useMemo(() => {
    const yearBudgets = budgets.filter(b => b.year === activeYear);
    return getBudgetDetails({
      activeBudgets: yearBudgets,
      transactions: transactions,
      categories: categories,
      forDate: new Date(),
    }).filter(b => b.isFavorite);
  }, [getBudgetDetails, budgets, activeYear, transactions, categories]);

  const lastUpdatedDate = useMemo(() => {
    if (transactions.length === 0) return null;
    // Assuming transactions are sorted descending by date
    return new Date(transactions[0].date);
  }, [transactions]);
  
  const isLoading = userDataLoading || authLoading || isAnalyticsLoading || !analytics;

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
    <div className="space-y-6">
      {(transactions.length === 0 || showInstructions) && <InstructionsGuide />}
      
      {analytics ? (
        <>
           <div className="grid gap-4 md:grid-cols-2">
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

           <div className="grid gap-4 md:grid-cols-2">
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
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Income vs. Expense ({activeYear})</CardTitle>
              </CardHeader>
              <CardContent>
                <OverviewChart data={analytics.overviewData}/>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Transactions ({activeYear})</CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length > 0 ? (
                    <RecentTransactions transactions={transactions.slice(0, 5)} />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <p className="text-muted-foreground">No transactions yet for {activeYear}.</p>
                        <p className="text-sm text-muted-foreground">Add your first transaction to get started.</p>
                    </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ): <DashboardSkeleton />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
              <CardTitle className="flex items-center gap-2"><Flag className="text-primary" /> Savings Goals</CardTitle>
              <CardDescription>Track your progress towards your financial goals.</CardDescription>
          </CardHeader>
          <CardContent>
              <GoalProgress goals={goals} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
              <CardTitle className="flex items-center gap-2"><Star className="text-yellow-400 fill-yellow-400" /> Favorite Budgets ({activeYear})</CardTitle>
              <CardDescription>Your hand-picked budgets for quick insights.</CardDescription>
          </CardHeader>
          <CardContent>
              <BudgetProgress budgets={favoritedBudgets} />
          </CardContent>
        </Card>
      </div>

       <ForwardAnalyticsPanel />
    </div>
  );
}
