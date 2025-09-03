
"use client";

import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { useEffect, useMemo, useState } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { Skeleton } from "@/components/ui/skeleton";


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
    </div>
  )
}

export default function DashboardPage() {
  const { transactions, loading } = useUserData();
  const [startingBalance, setStartingBalance] = useState(0);

  useEffect(() => {
    const storedBalance = localStorage.getItem('startingBalance');
    if (storedBalance) {
      setStartingBalance(parseFloat(storedBalance));
    }
  }, []);

  const { totalIncome, totalExpenses, currentBalance, overviewData } = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const currentBalance = startingBalance + totalIncome - totalExpenses;
    
    // Generate data for overview chart
    const monthlyData: Record<string, { income: number, expense: number }> = {};
    
    transactions.forEach(t => {
      const month = new Date(t.date).toLocaleString('default', { month: 'short' });
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expense: 0 };
      }
      monthlyData[month][t.type] += t.amount;
    });

    const overviewData = Object.entries(monthlyData).map(([name, values]) => ({
      name,
      ...values
    })).reverse();


    return { totalIncome, totalExpenses, currentBalance, overviewData };
  }, [transactions, startingBalance]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Current Balance"
          value={currentBalance}
          icon="Wallet"
          trendValue="Your real-time balance"
        />
        <StatCard
          title="Total Income"
          value={totalIncome}
          icon="TrendingUp"
          trendValue="All-time income"
          variant="success"
        />
        <StatCard
          title="Total Expenses"
          value={totalExpenses}
          icon="TrendingDown"
          trendValue="All-time expenses"
          variant="danger"
        />
        <StatCard
          title="Savings Rate"
          value={savingsRate}
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
            <OverviewChart data={overviewData}/>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTransactions transactions={transactions.slice(0, 5)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
