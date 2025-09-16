
"use client";

import { DollarSign, TrendingUp, TrendingDown, Wallet, Target, CalendarClock, Star } from "lucide-react";
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
import { getDashboardAnalytics } from "@/lib/actions";
import type { DashboardAnalytics } from "@/lib/actions";
import { GoalProgress } from "@/components/dashboard/goal-progress";


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
  const { allTransactions, loading, getBudgetDetails, goals } = useUserData();
  const { user, showInstructions } = useAuth();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);

  useEffect(() => {
    if (!loading && user) {
      setIsAnalyticsLoading(true);
      getDashboardAnalytics({ transactions: allTransactions, userId: user.uid })
        .then(setAnalytics)
        .finally(() => setIsAnalyticsLoading(false));
    }
  }, [allTransactions, loading, user]);


  const favoritedBudgets = useMemo(() => {
    return getBudgetDetails().filter(b => b.isFavorite);
  }, [getBudgetDetails]);
  
  if (loading || isAnalyticsLoading || !analytics) {
    return <DashboardSkeleton />;
  }
  
  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });

  return (
    <div className="space-y-6">
      {(allTransactions.length === 0 || showInstructions) && <InstructionsGuide />}
      
      <div className="grid gap-4 md:grid-cols-1">
         <StatCard
          title="Current Balance"
          value={analytics.currentBalance}
          icon="Wallet"
          trendValue="Your real-time balance"
        />
      </div>

       <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Total Income"
          value={analytics.totalIncome}
          icon="TrendingUp"
          trendValue="All-time income"
          variant="success"
        />
        <StatCard
          title="Total Expenses"
          value={analytics.totalExpenses}
          icon="TrendingDown"
          trendValue="All-time expenses"
          variant="danger"
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
          trendValue="Based on all-time data"
          isPercentage
        />
      </div>
      
       <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Income vs. Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <OverviewChart data={analytics.overviewData}/>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {allTransactions.length > 0 ? (
                 <RecentTransactions transactions={allTransactions.slice(0, 5)} />
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-muted-foreground">No transactions yet.</p>
                    <p className="text-sm text-muted-foreground">Add your first transaction to get started.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="text-primary" /> Savings Goals</CardTitle>
              <CardDescription>Track your progress towards your financial goals.</CardDescription>
          </CardHeader>
          <CardContent>
              <GoalProgress goals={goals} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
              <CardTitle className="flex items-center gap-2"><Star className="text-yellow-400 fill-yellow-400" /> Favorite Budgets</CardTitle>
              <CardDescription>Your hand-picked budgets for quick insights.</CardDescription>
          </CardHeader>
          <CardContent>
              <BudgetProgress budgets={favoritedBudgets} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
