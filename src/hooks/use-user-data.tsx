"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  BudgetsProvider,
  useBudgets,
} from "@/hooks/use-budgets";
import {
  CategoriesProvider,
  useCategories,
} from "@/hooks/use-categories";
import { GoalsProvider, useGoals } from "@/hooks/use-goals";
import {
  RecurringTransactionsProvider,
  useRecurringTransactions,
} from "@/hooks/use-recurring-transactions";
import {
  SettingsDataProvider,
  useSettingsData,
} from "@/hooks/use-settings-data";
import {
  TransactionDataProvider,
  useTransactionData,
  type TransactionDataContextType,
} from "@/hooks/use-transactions";
import { buildProcessedGoals } from "@/lib/goal-progress";
import { domainSubscriptionsForPath } from "@/lib/data-subscriptions";
import type { ProcessedGoal, Transaction } from "@/types";

export { buildProcessedGoals } from "@/lib/goal-progress";

/**
 * Compatibility composition for the app shell.
 *
 * Each domain owns an independent context and memoized value. A change to a
 * recurring schedule, for example, no longer rerenders category-only
 * consumers. New code should consume the narrow domain hooks directly.
 */
export function UserDataProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const subscriptions = domainSubscriptionsForPath(pathname);

  return (
    <SettingsDataProvider enabled={subscriptions.settings}>
      <CategoriesProvider>
        <BudgetsProvider enabled={subscriptions.budgets}>
          <RecurringTransactionsProvider
            enabled={subscriptions.recurringTransactions}
          >
            <GoalsProvider enabled={subscriptions.goals}>
              {children}
            </GoalsProvider>
          </RecurringTransactionsProvider>
        </BudgetsProvider>
      </CategoriesProvider>
    </SettingsDataProvider>
  );
}

/**
 * Temporary compatibility hook for extensions that still expect the old
 * combined shape. Product screens use the domain hooks directly.
 */
export function useUserCollections() {
  const categories = useCategories();
  const budgets = useBudgets();
  const recurring = useRecurringTransactions();
  const goals = useGoals();
  const settings = useSettingsData();
  const loading =
    categories.loading ||
    budgets.loading ||
    recurring.loading ||
    goals.loading ||
    settings.loading;

  return useMemo(
    () => ({
      ...categories,
      ...budgets,
      ...recurring,
      ...goals,
      ...settings,
      loading,
    }),
    [budgets, categories, goals, loading, recurring, settings],
  );
}

export type UserDataContextType = ReturnType<
  typeof useUserCollections
> &
  TransactionDataContextType & {
    goals: ProcessedGoal[];
    allTransactions: Transaction[];
  };

/**
 * Legacy all-in-one API retained while downstream integrations migrate.
 * It intentionally exposes only the selected year's transactions.
 */
export function useUserData(): UserDataContextType {
  const collections = useUserCollections();
  const transactionData = useTransactionData();
  const loading = collections.loading || transactionData.loading;
  const processedGoals = useMemo(
    () =>
      buildProcessedGoals(
        collections.goals,
        collections.categories,
        transactionData.transactions,
        loading,
      ),
    [
      collections.categories,
      collections.goals,
      loading,
      transactionData.transactions,
    ],
  );

  return useMemo(
    () => ({
      ...collections,
      ...transactionData,
      goals: processedGoals,
      allTransactions: transactionData.transactions,
      loading,
    }),
    [collections, loading, processedGoals, transactionData],
  );
}

export { TransactionDataProvider };
