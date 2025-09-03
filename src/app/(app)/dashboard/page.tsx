
"use client";

import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { mockTransactions } from "@/lib/data";
import { useEffect, useState } from "react";


export default function DashboardPage() {
  const [startingBalance, setStartingBalance] = useState(0);

  useEffect(() => {
    const storedBalance = localStorage.getItem('startingBalance');
    if (storedBalance) {
      setStartingBalance(parseFloat(storedBalance));
    }
  }, []);

  const totalIncome = mockTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = mockTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const currentBalance = startingBalance + totalIncome - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Current Balance"
          value={currentBalance}
          icon="Wallet"
          trendValue="+2.1% from last month"
        />
        <StatCard
          title="Total Income"
          value={totalIncome}
          icon="TrendingUp"
          trendValue="+15.2% from last month"
          variant="success"
        />
        <StatCard
          title="Total Expenses"
          value={totalExpenses}
          icon="TrendingDown"
          trendValue="+10.5% from last month"
          variant="danger"
        />
        <StatCard
          title="Savings"
          value={currentBalance > 0 ? (currentBalance / totalIncome) * 100 : 0}
          icon="DollarSign"
          trendValue="vs. 28% last month"
          isPercentage
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Income vs. Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <OverviewChart />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTransactions transactions={mockTransactions.slice(0, 5)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
