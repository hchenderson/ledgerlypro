import { describe, expect, it } from "vitest";

import { computeDashboardAnalytics } from "./dashboard-analytics";
import type { Transaction } from "@/types";

const transaction = (
  id: string,
  date: string,
  amount: number,
  type: Transaction["type"]
): Transaction => ({
  id,
  date,
  amount,
  type,
  description: id,
  category: "General",
});

describe("computeDashboardAnalytics", () => {
  it("uses the selected reporting year instead of the system year", () => {
    const result = computeDashboardAnalytics(
      [
        transaction("june-income", "2024-06-05T12:00:00.000Z", 500, "income"),
        transaction("july-income", "2024-07-05T12:00:00.000Z", 1_000, "income"),
        transaction("july-expense", "2024-07-06T12:00:00.000Z", 250, "expense"),
      ],
      100,
      new Date(2024, 6, 15)
    );

    expect(result.currentMonthIncome).toBe(1_000);
    expect(result.currentMonthExpenses).toBe(250);
    expect(result.previousMonthIncome).toBe(500);
    expect(result.currentBalance).toBe(1_350);
  });

  it("orders overview points chronologically", () => {
    const result = computeDashboardAnalytics(
      [
        transaction("march", "2025-03-01T12:00:00.000Z", 10, "expense"),
        transaction("january", "2025-01-01T12:00:00.000Z", 20, "income"),
      ],
      0,
      new Date(2025, 2, 1)
    );

    expect(result.overviewData.map((point) => point.name)).toEqual(["Jan", "Mar"]);
  });
});
