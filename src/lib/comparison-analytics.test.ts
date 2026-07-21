import { describe, expect, it } from "vitest";

import { computeYearComparison } from "./comparison-analytics";
import type { Transaction } from "@/types";

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

  it("compares matching months and computes KPI deltas", () => {
    const result = computeYearComparison(transactions, 2025, 2024, {
      startMonth: 0,
      endMonth: 1,
    });

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
    const result = computeYearComparison(transactions, 2025, 2024, {
      startMonth: 0,
      endMonth: 1,
    });

    expect(result.expenseCategories.map((item) => item.category)).toEqual([
      "Food",
      "Travel",
    ]);
    expect(result.expenseCategories[0].delta).toBe(-100);
    expect(result.expenseCategories[1].comparison).toBe(0);
    expect(result.expenseCategories[1].percentChange).toBeNull();
  });

  it("normalizes reversed and out-of-range month selections", () => {
    const result = computeYearComparison(transactions, 2025, 2024, {
      startMonth: 14,
      endMonth: -3,
    });

    expect(result.monthly).toHaveLength(12);
    expect(result.monthly[0].month).toBe("Jan");
    expect(result.monthly[11].month).toBe("Dec");
  });
});
