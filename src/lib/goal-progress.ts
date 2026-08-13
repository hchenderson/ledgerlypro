import {
  findCategoryByIdRecursive,
  getCategorySubtreeIdsAndNames,
} from "@/lib/category-tree";
import type {
  Category,
  Goal,
  ProcessedGoal,
  Transaction,
} from "@/types";
import { transactionAmount } from "@/lib/financial-summary";
import { isFinancialTransaction } from "@/lib/accounts";
import { expandTransactionsForReporting } from "@/lib/transaction-allocations";

export function buildProcessedGoals(
  goals: Goal[],
  categories: Category[],
  transactions: Transaction[],
  loading: boolean,
  envelopeAvailable: Map<string, number> = new Map(),
): ProcessedGoal[] {
  if (loading) {
    return goals.map((goal) => ({
      ...goal,
      autoTrackingActive: false,
      autoSavedAmount: 0,
      contributingTransactions: [],
    }));
  }

  const reportingTransactions = expandTransactionsForReporting(transactions);
  return goals.map((goal) => {
    if (goal.linkedEnvelopeId) {
      const savedAmount = envelopeAvailable.get(goal.linkedEnvelopeId);
      if (savedAmount !== undefined) {
        return {
          ...goal,
          savedAmount,
          autoTrackingActive: true,
          autoSavedAmount: savedAmount,
          contributingTransactions: reportingTransactions.filter(
            (transaction) =>
              isFinancialTransaction(transaction) &&
              transaction.envelopeId === goal.linkedEnvelopeId &&
              transaction.type === "expense",
          ),
        };
      }
    }
    if (!goal.linkedCategoryId) {
      return {
        ...goal,
        autoTrackingActive: false,
        autoSavedAmount: 0,
        contributingTransactions: [],
      };
    }

    const category = findCategoryByIdRecursive(
      goal.linkedCategoryId,
      categories,
    );
    if (!category) {
      return {
        ...goal,
        autoTrackingActive: false,
        autoSavedAmount: 0,
        contributingTransactions: [],
      };
    }

    const { ids: subtreeIds, names: subtreeNames } =
      getCategorySubtreeIdsAndNames(category);
    const contributionStartDate = goal.contributionStartDate
      ? new Date(goal.contributionStartDate)
      : new Date(0);
    const contributions = reportingTransactions.filter((transaction) => {
      if (!isFinancialTransaction(transaction)) return false;
      if (transaction.type !== "expense") return false;
      if (new Date(transaction.date) < contributionStartDate) return false;

      const matchesById =
        transaction.categoryId &&
        subtreeIds.includes(transaction.categoryId);
      const matchesByName = subtreeNames.includes(transaction.category);
      const matchesByPath =
        !matchesById &&
        !matchesByName &&
        subtreeNames.some(
          (name) =>
            transaction.category === name ||
            transaction.category.endsWith(`> ${name}`),
        );

      return Boolean(matchesById || matchesByName || matchesByPath);
    });
    const autoSavedAmount = contributions.reduce(
      (sum, transaction) => sum + transactionAmount(transaction),
      0,
    );

    return {
      ...goal,
      savedAmount: autoSavedAmount,
      autoTrackingActive: true,
      autoSavedAmount,
      contributingTransactions: contributions,
      contributionLedger: contributions.map((transaction) => ({
        transactionId: transaction.id,
        date: transaction.date,
        amount: transactionAmount(transaction),
        description: transaction.description,
        category: transaction.category,
      })),
    };
  });
}
