
// /app/reports/eoy/page.tsx
"use client";

import { useCategories } from "@/hooks/use-categories";
import { useGoals } from "@/hooks/use-goals";
import { useAccounts } from "@/hooks/use-accounts";
import { useAllTransactions } from "@/hooks/use-transactions";
import { EOYReport } from "@/components/reports/EOYReport";
import { useAuth } from "@/hooks/use-auth";

export default function EOYReportPage() {
  const {
    categories,
    loading: categoriesLoading,
  } = useCategories();
  const { goals, loading: goalsLoading } = useGoals();
  const {
    openingBalanceForSelection: startingBalance,
    loading: accountsLoading,
  } = useAccounts();
  const {
    transactions: allTransactions,
    loading: transactionsLoading,
    error: transactionsError,
  } = useAllTransactions();
  const { activeYear } = useAuth();
  const loading =
    categoriesLoading ||
    goalsLoading ||
    accountsLoading ||
    transactionsLoading;

  if (loading) {
    return (
      <div
        className="flex min-h-48 items-center justify-center px-3 py-6 text-sm text-muted-foreground sm:px-6"
        role="status"
        aria-live="polite"
      >
        Loading your end-of-year report…
      </div>
    );
  }

  if (transactionsError) {
    return (
      <div className="px-3 py-6 text-sm text-destructive sm:px-6">
        End-of-year data is temporarily unavailable. Please try again.
      </div>
    );
  }

  return (
    <div className="px-0 py-2 sm:px-2 sm:py-4 lg:p-6">
      <EOYReport
        allTransactions={allTransactions}
        categories={categories}
        goals={goals}
        startingBalance={startingBalance}
        initialYear={activeYear}
      />
    </div>
  );
}
