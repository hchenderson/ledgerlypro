import { describe, expect, it } from "vitest";

import {
  buildComparisonDateRanges,
  computeYearComparison,
} from "./comparison-analytics";
import {
  filterTransactionsByDateRange,
  summarizeTransactions,
} from "./financial-summary";
import type { Category, Transaction } from "@/types";

const transaction = (
  id: string,
  date: string,
  amount: number,
  type: Transaction["type"],
  category: string
): Transaction => ({ id, date, amount, type, category, description: id });

describe("computeYearComparison", () => {
  const transactions: Transaction[] = [
    transaction("income-2025", "2025-01-05T12:00:00.000Z", 1_000, "income", "Salary"),
    transaction("food-2025", "2025-01-06T12:00:00.000Z", 300, "expense", "Food"),
    transaction("travel-2025", "2025-02-06T12:00:00.000Z", 100, "expense", "Travel"),
    transaction("income-2024", "2024-01-05T12:00:00.000Z", 800, "income", "Salary"),
    transaction("food-2024", "2024-01-06T12:00:00.000Z", 400, "expense", "Food"),
    transaction("outside-range", "2024-08-06T12:00:00.000Z", 900, "expense", "Travel"),
  ];
  const fullYearRanges = buildComparisonDateRanges({
    preset: "full",
    primaryYear: 2025,
    comparisonYear: 2024,
  });

  it("compares matching months and computes KPI deltas", () => {
    const ranges = buildComparisonDateRanges({
      preset: "custom",
      primaryYear: 2025,
      comparisonYear: 2024,
      startMonth: 0,
      endMonth: 1,
    });
    const result = computeYearComparison(transactions, 2025, 2024, ranges);

    expect(result.primary.income).toBe(1_000);
    expect(result.primary.expenses).toBe(400);
    expect(result.comparison.income).toBe(800);
    expect(result.comparison.expenses).toBe(400);
    expect(result.deltas.net.value).toBe(200);
    expect(result.deltas.income.percent).toBe(25);
    expect(result.monthly).toHaveLength(2);
    expect(result.monthly[1].primaryCumulativeNet).toBe(600);
  });

  it("combines categories from both years and calculates shares", () => {
    const ranges = buildComparisonDateRanges({
      preset: "custom",
      primaryYear: 2025,
      comparisonYear: 2024,
      startMonth: 0,
      endMonth: 1,
    });
    const result = computeYearComparison(transactions, 2025, 2024, ranges);

    expect(result.expenseCategories.map((item) => item.category)).toEqual([
      "Food",
      "Travel",
    ]);
    expect(result.expenseCategories[0].delta).toBe(-100);
    expect(result.expenseCategories[1].comparison).toBe(0);
    expect(result.expenseCategories[1].percentChange).toBeNull();
  });

  it("normalizes reversed and out-of-range month selections", () => {
    const ranges = buildComparisonDateRanges({
      preset: "custom",
      primaryYear: 2025,
      comparisonYear: 2024,
      startMonth: 14,
      endMonth: -3,
    });
    const result = computeYearComparison(transactions, 2025, 2024, ranges);

    expect(result.monthly).toHaveLength(12);
    expect(result.monthly[0].month).toBe("Jan");
    expect(result.monthly[11].month).toBe("Dec");
  });

  it("builds exact first-half and second-half date ranges", () => {
    const firstHalf = buildComparisonDateRanges({
      preset: "h1",
      primaryYear: 2026,
      comparisonYear: 2025,
    });
    const secondHalf = buildComparisonDateRanges({
      preset: "h2",
      primaryYear: 2026,
      comparisonYear: 2025,
    });

    expect([
      firstHalf.primary.from.getMonth(),
      firstHalf.primary.from.getDate(),
      firstHalf.primary.to.getMonth(),
      firstHalf.primary.to.getDate(),
    ]).toEqual([0, 1, 5, 30]);
    expect([
      secondHalf.primary.from.getMonth(),
      secondHalf.primary.from.getDate(),
      secondHalf.primary.to.getMonth(),
      secondHalf.primary.to.getDate(),
    ]).toEqual([6, 1, 11, 31]);
  });

  it("builds exact custom-day ranges for both comparison years", () => {
    const ranges = buildComparisonDateRanges({
      preset: "custom-dates",
      primaryYear: 2026,
      comparisonYear: 2025,
      primaryStartDate: new Date(2026, 1, 12),
      primaryEndDate: new Date(2026, 3, 27),
    });

    expect(ranges.primary.from).toEqual(new Date(2026, 1, 12));
    expect(ranges.primary.to).toEqual(new Date(2026, 3, 27));
    expect(ranges.comparison.from).toEqual(new Date(2025, 1, 12));
    expect(ranges.comparison.to).toEqual(new Date(2025, 3, 27));
  });

  it("matches the shared report summary for the same date range", () => {
    const result = computeYearComparison(
      transactions,
      2025,
      2024,
      fullYearRanges
    );
    const reportSummary = summarizeTransactions(
      filterTransactionsByDateRange(transactions, fullYearRanges.primary)
    );

    expect(result.primary.income).toBe(reportSummary.income);
    expect(result.primary.expenses).toBe(reportSummary.expenses);
    expect(result.primary.net).toBe(reportSummary.net);
    expect(result.primary.transactionCount).toBe(reportSummary.transactionCount);
  });

  it("ends YTD on today and uses the matching comparison-year day", () => {
    const ranges = buildComparisonDateRanges({
      preset: "ytd",
      primaryYear: 2026,
      comparisonYear: 2025,
      now: new Date(2026, 6, 21),
    });
    const result = computeYearComparison(
      [
        transaction("primary-through-today", "2026-07-21T12:00:00.000", 10, "income", "Salary"),
        transaction("primary-after-today", "2026-07-22T12:00:00.000", 20, "income", "Salary"),
        transaction("comparison-through-day", "2025-07-21T12:00:00.000", 30, "income", "Salary"),
        transaction("comparison-after-day", "2025-07-22T12:00:00.000", 40, "income", "Salary"),
      ],
      2026,
      2025,
      ranges
    );

    expect(result.primary.income).toBe(10);
    expect(result.comparison.income).toBe(30);
  });

  it("rolls subcategories up to the same main categories used by reports", () => {
    const categories: Category[] = [
      {
        id: "housing",
        name: "Housing",
        type: "expense",
        subCategories: [{ id: "rent", name: "Rent", subCategories: [] }],
      },
    ];
    const result = computeYearComparison(
      [
        {
          ...transaction("rent", "2025-01-05T12:00:00.000", 500, "expense", "Rent"),
          categoryId: "rent",
        },
      ],
      2025,
      2024,
      fullYearRanges,
      categories
    );

    expect(result.expenseCategories[0].category).toBe("Housing");
  });

  it("removes excluded main categories from every comparison metric", () => {
    const categories: Category[] = [
      {
        id: "housing",
        name: "Housing",
        type: "expense",
        subCategories: [{ id: "rent", name: "Rent", subCategories: [] }],
      },
      {
        id: "salary",
        name: "Salary",
        type: "income",
        subCategories: [],
      },
    ];
    const result = computeYearComparison(
      [
        {
          ...transaction("salary", "2025-01-05", 2_000, "income", "Salary"),
          categoryId: "salary",
        },
        {
          ...transaction("rent", "2025-01-06", 900, "expense", "Rent"),
          categoryId: "rent",
        },
        transaction("food", "2025-01-07", 200, "expense", "Food"),
      ],
      2025,
      2024,
      fullYearRanges,
      categories,
      ["expense:housing"],
    );

    expect(result.primary.income).toBe(2_000);
    expect(result.primary.expenses).toBe(200);
    expect(result.primary.net).toBe(1_800);
    expect(result.primary.transactionCount).toBe(2);
    expect(result.monthly[0].primaryExpenses).toBe(200);
    expect(result.expenseCategories.map((item) => item.category)).toEqual([
      "Uncategorized",
    ]);
    expect(result.primary.largestExpense?.id).toBe("food");
  });

  it.each([
    ["full", 0, 11],
    ["ytd", 0, 11],
    ["h1", 0, 11],
    ["h2", 0, 11],
    ["q1", 0, 11],
    ["q2", 0, 11],
    ["q3", 0, 11],
    ["q4", 0, 11],
    ["custom-dates", 0, 11],
    ["custom", 2, 7],
  ] as const)(
    "keeps Compare and Reports totals identical for the %s preset",
    (preset, startMonth, endMonth) => {
      const parityTransactions: Transaction[] = [
        transaction("jan-income", "2026-01-01", 1_200.25, "income", "Salary"),
        transaction("jan-expense", "2026-01-31T23:59:00.000", -200.1, "expense", "Housing"),
        transaction("apr-income", "2026-04-15T12:00:00.000", -900.75, "income", "Salary"),
        transaction("jul-expense", "2026-07-21T22:00:00.000", 175.55, "expense", "Food"),
        transaction("after-ytd", "2026-07-22T09:00:00.000", 50, "expense", "Food"),
        transaction("oct-expense", "2026-10-10T12:00:00.000", 80.2, "expense", "Travel"),
        transaction("prior-income", "2025-01-01", 1_000, "income", "Salary"),
        transaction("prior-expense", "2025-07-21T22:00:00.000", -125, "expense", "Food"),
        transaction("prior-after-ytd", "2025-07-22T09:00:00.000", 25, "expense", "Food"),
      ];
      const ranges = buildComparisonDateRanges({
        preset,
        primaryYear: 2026,
        comparisonYear: 2025,
        now: new Date(2026, 6, 21),
        startMonth,
        endMonth,
      });
      const comparison = computeYearComparison(
        parityTransactions,
        2026,
        2025,
        ranges
      );
      const primaryReport = summarizeTransactions(
        filterTransactionsByDateRange(parityTransactions, ranges.primary)
      );
      const priorReport = summarizeTransactions(
        filterTransactionsByDateRange(parityTransactions, ranges.comparison)
      );

      expect(comparison.primary).toMatchObject(primaryReport);
      expect(comparison.comparison).toMatchObject(priorReport);
      expect(
        comparison.incomeCategories.reduce((sum, item) => sum + item.primary, 0)
      ).toBe(primaryReport.income);
      expect(
        comparison.expenseCategories.reduce((sum, item) => sum + item.primary, 0)
      ).toBe(primaryReport.expenses);
    }
  );
});
