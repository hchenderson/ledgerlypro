import { describe, expect, it } from "vitest";

import { calculateQuarterlyReportMetrics } from "./quarterly-report";
import {
  filterTransactionsByDateRange,
  summarizeTransactions,
} from "./financial-summary";
import {
  buildComparisonDateRanges,
  computeYearComparison,
} from "./comparison-analytics";
import type { Budget, Category, Goal, Transaction } from "@/types";

const categories: Category[] = [
  {
    id: "housing",
    name: "Housing",
    type: "expense",
    subCategories: [{ id: "rent", name: "Rent" }],
  },
  { id: "salary", name: "Salary", type: "income" },
];

const transactions: Transaction[] = [
  {
    id: "income",
    date: "2025-01-01T12:00:00.000Z",
    description: "Pay",
    amount: -5_000,
    type: "income",
    category: "Salary",
  },
  {
    id: "rent",
    date: "2025-01-02T12:00:00.000Z",
    description: "Rent",
    amount: -1_200,
    type: "expense",
    category: "A stale category label",
    categoryId: "rent",
  },
  {
    id: "transfer-out",
    date: "2025-01-03T12:00:00.000Z",
    description: "Move to savings",
    amount: 400,
    type: "transfer",
    category: "Transfer",
    accountId: "checking",
    transferId: "move",
    transferDirection: "out",
  },
  {
    id: "transfer-in",
    date: "2025-01-03T12:00:00.000Z",
    description: "Move to savings",
    amount: 400,
    type: "transfer",
    category: "Transfer",
    accountId: "savings",
    transferId: "move",
    transferDirection: "in",
  },
];

const budgets: Budget[] = [
  { id: "budget", categoryId: "rent", amount: 1_000, period: "monthly", year: 2025 },
  { id: "wrong-year", categoryId: "rent", amount: 9_000, period: "monthly", year: 2024 },
];

const goals: Goal[] = [
  { id: "goal", name: "Reserve", targetAmount: 2_000, savedAmount: 500 },
];

describe("calculateQuarterlyReportMetrics", () => {
  it("calculates quarterly totals and nested-category budgets", () => {
    const result = calculateQuarterlyReportMetrics({
      transactions,
      categories,
      budgets,
      goals,
      reportYear: 2025,
    });

    expect(result.totalIncome).toBe(5_000);
    expect(result.totalExpenses).toBe(1_200);
    expect(result.transactionCount).toBe(2);
    expect(result.netIncome).toBe(3_800);
    expect(result.incomeSummary).toEqual({ Salary: 5_000 });
    expect(result.expenseSummary).toEqual({ Housing: 1_200 });
    expect(result.budgetComparison).toHaveLength(1);
    expect(result.budgetComparison[0]).toMatchObject({
      budget: 3_000,
      actual: 1_200,
      variance: 1_800,
      percentUsed: 40,
    });
    expect(result.goalsProgress[0].progress).toBe(25);
    expect(result.kpis.savingsRate).toBe(76);
    expect(result.kpis.averageMonthlyNet).toBeCloseTo(1_266.67, 2);
  });

  it("reconciles exactly with the shared Reports and Compare summary", () => {
    const ranges = buildComparisonDateRanges({
      preset: "q1",
      primaryYear: 2025,
      comparisonYear: 2024,
    });
    const quarterTransactions = filterTransactionsByDateRange(
      transactions,
      ranges.primary
    );
    const quarterly = calculateQuarterlyReportMetrics({
      transactions: quarterTransactions,
      categories,
      budgets,
      goals,
      reportYear: 2025,
    });
    const shared = summarizeTransactions(quarterTransactions);
    const comparison = computeYearComparison(
      transactions,
      2025,
      2024,
      ranges,
      categories
    );

    expect({
      income: quarterly.totalIncome,
      expenses: quarterly.totalExpenses,
      net: quarterly.netIncome,
      transactionCount: quarterly.transactionCount,
    }).toEqual(shared);
    expect(quarterly.totalIncome).toBe(comparison.primary.income);
    expect(quarterly.totalExpenses).toBe(comparison.primary.expenses);
    expect(quarterly.netIncome).toBe(comparison.primary.net);
    expect(quarterly.transactionCount).toBe(
      comparison.primary.transactionCount
    );
    expect(comparison.primary.averageTransaction).toBe(3_100);
    expect(
      Object.values(quarterly.incomeSummary).reduce(
        (sum, amount) => sum + amount,
        0
      )
    ).toBe(shared.income);
    expect(
      Object.values(quarterly.expenseSummary).reduce(
        (sum, amount) => sum + amount,
        0
      )
    ).toBe(shared.expenses);
  });
});
