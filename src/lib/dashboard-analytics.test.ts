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

  it("keeps transfers out of income and expenses while updating an account balance", () => {
    const transferOut = {
      ...transaction(
        "transfer-out",
        "2025-03-05T12:00:00.000Z",
        200,
        "transfer",
      ),
      transferDirection: "out" as const,
    };
    const transferIn = {
      ...transaction(
        "transfer-in",
        "2025-03-05T12:00:00.000Z",
        200,
        "transfer",
      ),
      transferDirection: "in" as const,
    };

    const allAccounts = computeDashboardAnalytics(
      [transferOut, transferIn],
      1_500,
      new Date(2025, 2, 1),
    );
    const sourceAccount = computeDashboardAnalytics(
      [transferOut],
      1_000,
      new Date(2025, 2, 1),
    );

    expect(allAccounts).toMatchObject({
      totalIncome: 0,
      totalExpenses: 0,
      currentBalance: 1_500,
      savingsRate: 0,
    });
    expect(sourceAccount).toMatchObject({
      totalIncome: 0,
      totalExpenses: 0,
      currentBalance: 800,
    });
  });

  it("normalizes legacy negative amounts", () => {
    const result = computeDashboardAnalytics(
      [
        transaction(
          "legacy-income",
          "2025-01-01T12:00:00.000Z",
          -500,
          "income",
        ),
        transaction(
          "legacy-expense",
          "2025-01-02T12:00:00.000Z",
          -125,
          "expense",
        ),
      ],
      0,
      new Date(2025, 0, 1),
    );

    expect(result.totalIncome).toBe(500);
    expect(result.totalExpenses).toBe(125);
    expect(result.currentBalance).toBe(375);
  });

  it("excludes entries after an explicit balance cutoff date", () => {
    const result = computeDashboardAnalytics(
      [
        transaction("posted", "2026-08-12T09:00:00.000", 500, "income"),
        transaction("future", "2026-08-13T09:00:00.000", 300, "income"),
      ],
      100,
      new Date(2026, 7, 12),
      new Date(2026, 7, 12),
    );

    expect(result.currentBalance).toBe(600);
    expect(result.totalIncome).toBe(500);
  });
});
