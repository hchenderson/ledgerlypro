
"use client";

import { DollarSign, TrendingUp, TrendingDown, Wallet, X, CheckCircle, Target, CalendarClock, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { BudgetProgress } from "@/components/dashboard/budget-progress";
import { useEffect, useMemo, useState } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";


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

function GettingStartedGuide({ onClearData, onDismiss }: { onClearData: () => void, onDismiss: () => void }) {
    return (
        <Alert className="mb-6 bg-primary/5 border-primary/20 relative pr-10">
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={onDismiss}>
                <X className="h-4 w-4" />
                <span className="sr-only">Dismiss</span>
            </Button>
            <CheckCircle className="h-4 w-4 text-primary" />
            <AlertTitle className="font-headline text-lg text-primary">Welcome to Ledgerly!</AlertTitle>
            <AlertDescription className="text-muted-foreground mt-2">
                <p className="mb-4">You're all set up! We've loaded some sample data so you can explore. Here's what to do next:</p>
                <ol className="list-decimal list-inside space-y-2 mb-4">
                    <li><strong>Explore the Dashboard:</strong> Check out your balances and charts below.</li>
                    <li><strong>View Transactions:</strong> Head to the "Transactions" page to see the sample data.</li>
                    <li><strong>Add a New Transaction:</strong> Click the "New Transaction" button in the header.</li>
                </ol>
                <p className="font-semibold">Ready to start with your own data?</p>
                <Button onClick={onClearData} size="sm" className="mt-2">Clear Sample Data & Start Fresh</Button>
            </AlertDescription>
        </Alert>
    )
}

export default function DashboardPage() {
  const { transactions, loading, clearAllData, budgets, categories } = useUserData();
  const { user } = useAuth();
  const [startingBalance, setStartingBalance] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(true);

  useEffect(() => {
    if (user) {
        const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'main');
        getDoc(settingsDocRef).then(docSnap => {
            if (docSnap.exists()) {
                setStartingBalance(docSnap.data().startingBalance || 0);
                 if (docSnap.data().guideDismissed) {
                    setGuideDismissed(true);
                } else {
                    setGuideDismissed(false);
                }
            } else {
                 setGuideDismissed(false);
            }
        });
    }
  }, [user]);

  const { 
      totalIncome, 
      totalExpenses, 
      currentBalance, 
      overviewData,
      currentMonthIncome,
      currentMonthExpenses
    } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const currentMonthIncome = transactions
      .filter(t => {
          const transactionDate = new Date(t.date);
          return t.type === 'income' && transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear
      })
      .reduce((sum, t) => sum + t.amount, 0);
      
    const currentMonthExpenses = transactions
      .filter(t => {
          const transactionDate = new Date(t.date);
          return t.type === 'expense' && transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear
      })
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


    return { totalIncome, totalExpenses, currentBalance, overviewData, currentMonthIncome, currentMonthExpenses };
  }, [transactions, startingBalance]);

  const handleClearData = async () => {
    await clearAllData();
    await handleDismissGuide();
  }

  const handleDismissGuide = async () => {
    if(!user) return;
    setGuideDismissed(true);
    const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'main');
    await setDoc(settingsDocRef, { guideDismissed: true }, { merge: true });
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
  const favoritedBudgets = budgets.filter(b => b.isFavorite);

  return (
    <div className="space-y-6">
      {!guideDismissed && transactions.length > 0 && <GettingStartedGuide onClearData={handleClearData} onDismiss={handleDismissGuide} />}
      
      <div className="grid gap-4 md:grid-cols-1">
         <StatCard
          title="Current Balance"
          value={currentBalance}
          icon="Wallet"
          trendValue="Your real-time balance"
        />
      </div>

       <div className="grid gap-4 md:grid-cols-2">
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
      </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={`${currentMonthName} Income`}
          value={currentMonthIncome}
          icon="CalendarClock"
          trendValue="Income this month"
          variant="success"
        />
        <StatCard
          title={`${currentMonthName} Expenses`}
          value={currentMonthExpenses}
          icon="CalendarClock"
          trendValue="Expenses this month"
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
            {transactions.length > 0 ? (
                 <RecentTransactions transactions={transactions.slice(0, 5)} />
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-muted-foreground">No transactions yet.</p>
                    <p className="text-sm text-muted-foreground">Add your first transaction to get started.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

       <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Star className="text-yellow-400 fill-yellow-400" /> Favorite Budgets</CardTitle>
            <CardDescription>Your hand-picked budgets for quick insights.</CardDescription>
        </CardHeader>
        <CardContent>
            <BudgetProgress budgets={favoritedBudgets} transactions={transactions} categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
