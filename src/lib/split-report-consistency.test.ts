import { describe, expect, it } from "vitest";
import type { Category, Transaction } from "@/types";
import { computeYearComparison } from "./comparison-analytics";
import { calculateQuarterlyReportMetrics } from "./quarterly-report";
import { computeReportAnalytics } from "./report-analytics";

const categories: Category[] = [
  { id: "general", name: "General Giving", type: "income" },
  { id: "mission-in", name: "Missionary Support Received", type: "income" },
  { id: "mission-out", name: "Missionary Support Sent", type: "expense" },
  { id: "utilities", name: "Utilities", type: "expense" },
];

const transactions: Transaction[] = [
  {
    id: "combined-deposit",
    date: "2026-02-15T12:00:00.000Z",
    description: "Sunday deposit",
    amount: 2_000,
    type: "income",
    category: "Split transaction",
    allocations: [
      { id: "general", amount: 1_550, category: "General Giving", categoryId: "general" },
      { id: "mission", amount: 450, category: "Missionary Support Received", categoryId: "mission-in" },
    ],
  },
  { id: "mission-payment", date: "2026-03-01T12:00:00.000Z", description: "Missionary payment", amount: 300, type: "expense", category: "Missionary Support Sent", categoryId: "mission-out" },
  { id: "utilities", date: "2026-03-02T12:00:00.000Z", description: "Utilities", amount: 500, type: "expense", category: "Utilities", categoryId: "utilities" },
];

const range = { from: new Date(2026, 0, 1), to: new Date(2026, 11, 31) };

describe("split transaction report consistency", () => {
  it("keeps Reports, Compare, and quarterly metrics identical", () => {
    const report = computeReportAnalytics(
      transactions,
      range,
      {
        accountIds: [],
        transactionTypes: ["income", "expense"],
        includedCategoryKeys: [],
        excludedCategoryKeys: [],
        includePending: false,
        includeTransfers: false,
      },
      categories,
      [],
      "month",
    );
    const comparison = computeYearComparison(
      transactions,
      2026,
      2025,
      {
        primary: range,
        comparison: { from: new Date(2025, 0, 1), to: new Date(2025, 11, 31) },
      },
      categories,
    );
    const quarterly = calculateQuarterlyReportMetrics({
      transactions,
      categories,
      budgets: [],
      goals: [],
      reportYear: 2026,
    });

    expect(report.summary).toMatchObject({ income: 2_000, expenses: 800, net: 1_200 });
    expect(report.summary.transactionCount).toBe(3);
    expect(comparison.primary).toMatchObject({ income: 2_000, expenses: 800, net: 1_200 });
    expect(quarterly).toMatchObject({ totalIncome: 2_000, totalExpenses: 800, netIncome: 1_200 });
    expect(report.incomeCategories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "General Giving", amount: 1_550 }),
        expect.objectContaining({ category: "Missionary Support Received", amount: 450 }),
      ]),
    );
  });
});
