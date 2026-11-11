import { endOfQuarter, startOfQuarter } from "date-fns";

import { computeReportAnalytics, computeReportBudgets } from "@/lib/report-analytics";
import type { FinancialDateRange } from "@/lib/financial-summary";
import type { Budget, Category, Goal, Transaction } from "@/types";
import { ledgerDateToDate, transactionLedgerDate } from "@/lib/ledger-date";

export interface QuarterlyCategorySummary {
  key: string;
  categoryId: string | null;
  name: string;
  total: number;
  percentageOfTotal: number;
  status: "resolved" | "uncategorized" | "unresolved";
}

export interface QuarterlyReportMetrics {
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  /** Compatibility fields retained for snapshots created before calculation v4. */
  incomeSummary: Record<string, number>;
  expenseSummary: Record<string, number>;
  incomeCategories: QuarterlyCategorySummary[];
  expenseCategories: QuarterlyCategorySummary[];
  netIncome: number;
  budgetComparison: Array<{
    budgetId: string;
    categoryName: string;
    budget: number;
    actual: number;
    subtreeActual: number;
    variance: number;
    percentUsed: number;
    isUnbudgeted?: boolean;
  }>;
  budgetComparisonTotals: {
    budget: number;
    actual: number;
    variance: number;
    percentUsed: number;
  };
  goalsProgress: Array<{
    id: string;
    name: string;
    targetAmount: number;
    historicalProgressAvailable: false;
    historicalSavedAmount: null;
    historicalProgress: null;
    currentSavedAmount: number;
    currentProgress: number;
  }>;
  kpis: {
    profitMargin: number;
    expenseToIncomeRatio: number;
    savingsRate: number;
    averageMonthlyNet: number;
  };
}

function compatibilitySummary(rows: QuarterlyCategorySummary[]) {
  return Object.fromEntries(rows.map((row) => [row.name, row.total]));
}

export function calculateQuarterlyReportMetrics({
  transactions,
  categories,
  budgets,
  goals,
  reportYear,
  range,
  accountIds = [],
  defaultAccountId,
}: {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: Goal[];
  reportYear: number;
  range?: FinancialDateRange;
  accountIds?: string[];
  defaultAccountId?: string | null;
}): QuarterlyReportMetrics {
  const firstDate = transactions
    .map((transaction) => ledgerDateToDate(transactionLedgerDate(transaction)))
    .find((date) => !Number.isNaN(date.getTime()));
  const effectiveRange = range ?? {
    from: startOfQuarter(firstDate ?? new Date(reportYear, 0, 1)),
    to: endOfQuarter(firstDate ?? new Date(reportYear, 0, 1)),
  };
  const reportFilters = {
    accountIds,
    transactionTypes: ["income", "expense"] as ("income" | "expense")[],
    includedCategoryKeys: [],
    excludedCategoryKeys: [],
    includePending: false,
    includeTransfers: false,
  };
  const analytics = computeReportAnalytics(
    transactions,
    effectiveRange,
    reportFilters,
    categories,
    [],
    "month",
    defaultAccountId,
  );
  const budgetSummary = computeReportBudgets(
    budgets.filter((budget) => budget.year === reportYear),
    categories,
    analytics.financialTransactions,
    effectiveRange,
    reportFilters,
  );
  const incomeCategories = analytics.incomeCategories.map((row) => ({
    key: row.key ?? `income:${row.category}`,
    categoryId: row.categoryId ?? null,
    name: row.category,
    total: row.amount,
    percentageOfTotal: row.share,
    status: row.status ?? "unresolved",
  }));
  const expenseCategories = analytics.expenseCategories.map((row) => ({
    key: row.key ?? `expense:${row.category}`,
    categoryId: row.categoryId ?? null,
    name: row.category,
    total: row.amount,
    percentageOfTotal: row.share,
    status: row.status ?? "unresolved",
  }));
  const { income: totalIncome, expenses: totalExpenses, net: netIncome } =
    analytics.summary;

  return {
    totalIncome,
    totalExpenses,
    transactionCount: analytics.summary.transactionCount,
    incomeSummary: compatibilitySummary(incomeCategories),
    expenseSummary: compatibilitySummary(expenseCategories),
    incomeCategories,
    expenseCategories,
    netIncome,
    budgetComparison: budgetSummary.rows.map((row) => ({
      budgetId: row.budgetId,
      categoryName: row.categoryName,
      budget: row.budget,
      actual: row.actual,
      subtreeActual: row.subtreeActual ?? row.actual,
      variance: row.remaining,
      percentUsed: row.percentUsed,
      ...(row.isUnbudgeted ? { isUnbudgeted: true } : {}),
    })),
    budgetComparisonTotals: {
      budget: budgetSummary.budget,
      actual: budgetSummary.actual,
      variance: budgetSummary.remaining,
      percentUsed: budgetSummary.percentUsed,
    },
    goalsProgress: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      historicalProgressAvailable: false as const,
      historicalSavedAmount: null,
      historicalProgress: null,
      currentSavedAmount: goal.savedAmount,
      currentProgress:
        goal.targetAmount > 0
          ? (goal.savedAmount / goal.targetAmount) * 100
          : 0,
    })),
    kpis: {
      profitMargin: totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0,
      expenseToIncomeRatio:
        totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0,
      savingsRate: totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0,
      averageMonthlyNet: netIncome / 3,
    },
  };
}
