import { describe, expect, it } from "vitest";

import { calculateQuarterlyReportMetrics } from "./quarterly-report";
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
    amount: 5_000,
    type: "income",
    category: "Salary",
  },
  {
    id: "rent",
    date: "2025-01-02T12:00:00.000Z",
    description: "Rent",
    amount: 1_200,
    type: "expense",
    category: "A stale category label",
    categoryId: "rent",
  },
];

const budgets: Budget[] = [
  { id: "budget", categoryId: "rent", amount: 1_000, period: "monthly", year: 2025 },
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
    });

    expect(result.netIncome).toBe(3_800);
    expect(result.expenseSummary).toEqual({ Housing: 1_200 });
    expect(result.budgetComparison[0]).toMatchObject({
      budget: 3_000,
      actual: 1_200,
      variance: 1_800,
      percentUsed: 40,
    });
    expect(result.goalsProgress[0].progress).toBe(25);
  });
});
