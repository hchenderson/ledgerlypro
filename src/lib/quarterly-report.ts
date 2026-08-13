import {
  categorySubtreeIds,
  categorySubtreeNames,
  findCategoryPathById,
  findMainCategoryForTransaction,
  normalizeCategoryLabel,
} from "./category-tree";
import {
  summarizeTransactions,
  transactionAmount,
} from "./financial-summary";
import type { Budget, Category, Goal, Transaction } from "@/types";
import { isFinancialTransaction } from "./accounts";
import { expandTransactionsForReporting } from "./transaction-allocations";

export interface QuarterlyReportMetrics {
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  incomeSummary: Record<string, number>;
  expenseSummary: Record<string, number>;
  netIncome: number;
  budgetComparison: Array<{
    categoryName: string;
    budget: number;
    actual: number;
    variance: number;
    percentUsed: number;
  }>;
  budgetComparisonTotals: {
    budget: number;
    actual: number;
    variance: number;
    percentUsed: number;
  };
  goalsProgress: Array<{
    name: string;
    targetAmount: number;
    savedAmount: number;
    progress: number;
  }>;
  kpis: {
    profitMargin: number;
    expenseToIncomeRatio: number;
    savingsRate: number;
    averageMonthlyNet: number;
  };
}

function summarizeByCategory(
  transactions: Transaction[],
  type: Transaction["type"],
  categories: Category[]
): Record<string, number> {
  return transactions
    .filter(
      (transaction) =>
        isFinancialTransaction(transaction) && transaction.type === type,
    )
    .reduce<Record<string, number>>((totals, transaction) => {
      const mainCategory = findMainCategoryForTransaction(transaction, categories);
      totals[mainCategory] =
        (totals[mainCategory] ?? 0) + transactionAmount(transaction);
      return totals;
    }, {});
}

export function calculateQuarterlyReportMetrics({
  transactions,
  categories,
  budgets,
  goals,
  reportYear,
}: {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: Goal[];
  reportYear: number;
}): QuarterlyReportMetrics {
  const reportingTransactions = expandTransactionsForReporting(transactions);
  const {
    income: totalIncome,
    expenses: totalExpenses,
    net: netIncome,
    transactionCount,
  } = summarizeTransactions(transactions);

  const budgetComparison = budgets
    .filter((budget) => budget.year === reportYear)
    .flatMap((budget) => {
      const path = findCategoryPathById(budget.categoryId, categories);
      const category = path?.at(-1);
      const mainCategory = path?.[0] as Category | undefined;
      if (!category || mainCategory?.type !== "expense") return [];

      const budgetAmount =
        budget.period === "monthly" ? budget.amount * 3 : budget.amount / 4;
      const categoryIds = new Set(categorySubtreeIds(category));
      const categoryNames = new Set(
        categorySubtreeNames(category).map(normalizeCategoryLabel)
      );
      const actual = reportingTransactions
        .filter((transaction) => {
          if (
            !isFinancialTransaction(transaction) ||
            transaction.type !== "expense"
          ) return false;
          if (transaction.categoryId) {
            return categoryIds.has(transaction.categoryId);
          }
          return categoryNames.has(
            normalizeCategoryLabel(transaction.category)
          );
        })
        .reduce(
          (sum, transaction) => sum + transactionAmount(transaction),
          0
        );
      const variance = budgetAmount - actual;

      return [
        {
          categoryName: category.name,
          budget: budgetAmount,
          actual,
          variance,
          percentUsed: budgetAmount > 0 ? (actual / budgetAmount) * 100 : 0,
        },
      ];
    });

  const budgetComparisonTotals = budgetComparison.reduce(
    (totals, item) => ({
      ...totals,
      budget: totals.budget + item.budget,
      actual: totals.actual + item.actual,
    }),
    { budget: 0, actual: 0, variance: 0, percentUsed: 0 }
  );
  budgetComparisonTotals.variance =
    budgetComparisonTotals.budget - budgetComparisonTotals.actual;
  budgetComparisonTotals.percentUsed =
    budgetComparisonTotals.budget > 0
      ? (budgetComparisonTotals.actual / budgetComparisonTotals.budget) * 100
      : 0;

  return {
    totalIncome,
    totalExpenses,
    transactionCount,
    incomeSummary: summarizeByCategory(reportingTransactions, "income", categories),
    expenseSummary: summarizeByCategory(reportingTransactions, "expense", categories),
    netIncome,
    budgetComparison,
    budgetComparisonTotals,
    goalsProgress: goals.map((goal) => ({
      name: goal.name,
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
      progress: goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0,
    })),
    kpis: {
      profitMargin:
        totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0,
      expenseToIncomeRatio:
        totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0,
      savingsRate:
        totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0,
      averageMonthlyNet: netIncome / 3,
    },
  };
}
