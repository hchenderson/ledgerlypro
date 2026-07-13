import {
  categorySubtreeNames,
  findCategoryPathById,
  findMainCategoryName,
  normalizeCategoryLabel,
} from "./category-tree";
import type { Budget, Category, Goal, Transaction } from "@/types";

export interface QuarterlyReportMetrics {
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
  };
}

function summarizeByCategory(
  transactions: Transaction[],
  type: Transaction["type"],
  categories: Category[]
): Record<string, number> {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce<Record<string, number>>((totals, transaction) => {
      const mainCategory = findMainCategoryName(transaction.category, categories);
      totals[mainCategory] = (totals[mainCategory] ?? 0) + transaction.amount;
      return totals;
    }, {});
}

export function calculateQuarterlyReportMetrics({
  transactions,
  categories,
  budgets,
  goals,
}: {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: Goal[];
}): QuarterlyReportMetrics {
  const income = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const netIncome = income - expenses;

  const actualsByCategory = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce<Record<string, number>>((totals, transaction) => {
      const category = normalizeCategoryLabel(transaction.category);
      totals[category] = (totals[category] ?? 0) + transaction.amount;
      return totals;
    }, {});

  const budgetComparison = budgets.flatMap((budget) => {
    const path = findCategoryPathById(budget.categoryId, categories);
    const category = path?.at(-1);
    const mainCategory = path?.[0] as Category | undefined;
    if (!category || mainCategory?.type !== "expense") return [];

    const budgetAmount =
      budget.period === "monthly" ? budget.amount * 3 : budget.amount / 4;
    const actual = categorySubtreeNames(category).reduce(
      (sum, categoryName) => sum + (actualsByCategory[categoryName] ?? 0),
      0
    );
    const variance = budgetAmount - actual;

    return [{
      categoryName: category.name,
      budget: budgetAmount,
      actual,
      variance,
      percentUsed: budgetAmount > 0 ? (actual / budgetAmount) * 100 : 0,
    }];
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
    incomeSummary: summarizeByCategory(transactions, "income", categories),
    expenseSummary: summarizeByCategory(transactions, "expense", categories),
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
      profitMargin: income > 0 ? (netIncome / income) * 100 : 0,
      expenseToIncomeRatio: income > 0 ? (expenses / income) * 100 : 0,
    },
  };
}
