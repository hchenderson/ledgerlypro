import { describe, expect, it } from "vitest";

import {
  buildReportComparisonRange,
  computeCategoryMovement,
  computeReportAnalytics,
  computeReportBalances,
  computeReportBudgets,
  filterReportTransactions,
  type ReportFilterConfiguration,
} from "./report-analytics";
import type { Account, Budget, Category, Transaction } from "@/types";
import {
  buildComparisonDateRanges,
  computeYearComparison,
} from "./comparison-analytics";

const categories: Category[] = [
  {
    id: "salary",
    name: "Salary",
    type: "income",
    subCategories: [],
  },
  {
    id: "housing",
    name: "Housing",
    type: "expense",
    subCategories: [{ id: "rent", name: "Rent", subCategories: [] }],
  },
  {
    id: "food",
    name: "Food",
    type: "expense",
    subCategories: [],
  },
];

const account: Account = {
  id: "checking",
  name: "Checking",
  type: "checking",
  classification: "asset",
  openingBalance: 1_000,
  currency: "USD",
  isDefault: true,
  createdAt: "2025-01-01",
};

const transaction = (
  id: string,
  date: string,
  amount: number,
  type: Transaction["type"],
  category: string,
  extras: Partial<Transaction> = {},
): Transaction => ({
  id,
  date,
  amount,
  type,
  category,
  description: id,
  accountId: "checking",
  ...extras,
});

const range = {
  from: new Date(2026, 0, 1),
  to: new Date(2026, 0, 31),
};
const filters: ReportFilterConfiguration = {
  accountIds: [],
  transactionTypes: ["income", "expense"],
  includedCategoryKeys: [],
  excludedCategoryKeys: [],
  includePending: false,
  includeTransfers: true,
};

describe("report analytics", () => {
  const transactions: Transaction[] = [
    transaction("income", "2026-01-02", 3_000, "income", "Salary", {
      categoryId: "salary",
    }),
    transaction("rent", "2026-01-03", 1_000, "expense", "Rent", {
      categoryId: "rent",
    }),
    transaction("food", "2026-01-04", 250, "expense", "Food", {
      categoryId: "food",
    }),
    transaction("pending", "2026-01-05", 500, "expense", "Food", {
      categoryId: "food",
      postingStatus: "pending",
    }),
    transaction("transfer", "2026-01-06", 200, "transfer", "Transfer", {
      transferDirection: "out",
    }),
  ];

  it("uses one filtered set for totals, periods, categories, and exports", () => {
    const result = computeReportAnalytics(
      transactions,
      range,
      { ...filters, excludedCategoryKeys: ["expense:housing"] },
      categories,
      [account],
      "month",
      account.id,
    );

    expect(result.summary).toMatchObject({
      income: 3_000,
      expenses: 250,
      net: 2_750,
      transactionCount: 2,
    });
    expect(result.periods[0]).toMatchObject({ income: 3_000, expense: 250 });
    expect(result.expenseCategories.map((item) => item.category)).toEqual([
      "Food",
    ]);
    expect(result.transactions.map((item) => item.id)).toEqual([
      "income",
      "food",
      "transfer",
    ]);
  });

  it("can include pending entries explicitly without including removed ones", () => {
    const filtered = filterReportTransactions(
      [
        ...transactions,
        transaction("removed", "2026-01-07", 600, "expense", "Food", {
          postingStatus: "removed",
        }),
      ],
      range,
      { ...filters, includePending: true },
      categories,
      account.id,
    );

    expect(filtered.map((item) => item.id)).toContain("pending");
    expect(filtered.map((item) => item.id)).not.toContain("removed");
  });

  it("builds exact prior-period and prior-year comparison ranges", () => {
    const previous = buildReportComparisonRange(range, "previous-period");
    const priorYear = buildReportComparisonRange(range, "previous-year");

    expect(previous?.from).toEqual(new Date(2025, 11, 1));
    expect(previous?.to.getFullYear()).toBe(2025);
    expect(previous?.to.getMonth()).toBe(11);
    expect(previous?.to.getDate()).toBe(31);
    expect(priorYear?.from).toEqual(new Date(2025, 0, 1));
    expect(priorYear?.to).toEqual(new Date(2025, 0, 31));
  });

  it("computes category movement across both periods", () => {
    expect(
      computeCategoryMovement(
        [{ category: "Food", amount: 300, share: 100 }],
        [
          { category: "Food", amount: 200, share: 50 },
          { category: "Travel", amount: 200, share: 50 },
        ],
      ),
    ).toEqual([
      {
        category: "Travel",
        current: 0,
        comparison: 200,
        change: -200,
        percentChange: -100,
      },
      {
        category: "Food",
        current: 300,
        comparison: 200,
        change: 100,
        percentChange: 50,
      },
    ]);
  });

  it("includes transfers in account balances but not cash-flow totals", () => {
    const report = computeReportAnalytics(
      transactions,
      range,
      filters,
      categories,
      [account],
      "month",
      account.id,
    );
    const balances = computeReportBalances(
      transactions,
      [account],
      range,
      [],
    );

    expect(report.summary.net).toBe(1_750);
    expect(balances.startingBalance).toBe(1_000);
    expect(balances.endingBalance).toBe(2_550);
  });

  it("applies category filters to report-scoped balance cards", () => {
    const report = computeReportAnalytics(
      transactions,
      range,
      { ...filters, excludedCategoryKeys: ["expense:housing"] },
      categories,
      [account],
      "month",
      account.id,
    );
    const balances = computeReportBalances(
      transactions,
      [account],
      range,
      [],
      report.transactions,
    );

    expect(balances.startingBalance).toBe(1_000);
    expect(balances.change).toBe(2_550);
    expect(balances.endingBalance).toBe(3_550);
  });

  it("counts a paired internal transfer once in total money moved", () => {
    const result = computeReportAnalytics(
      [
        transaction("out", "2026-01-06", 200, "transfer", "Transfer", {
          transferId: "pair",
          transferDirection: "out",
        }),
        transaction("in", "2026-01-06", 200, "transfer", "Transfer", {
          transferId: "pair",
          transferDirection: "in",
        }),
      ],
      range,
      filters,
      categories,
      [account],
      "month",
      account.id,
    );

    expect(result.transfers.totalMoved).toBe(200);
    expect(result.transfers.count).toBe(1);
  });

  it("prorates monthly budgets to the selected range", () => {
    const budgets: Budget[] = [
      {
        id: "food-budget",
        categoryId: "food",
        amount: 620,
        period: "monthly",
        year: 2026,
      },
    ];
    const result = computeReportBudgets(
      budgets,
      categories,
      filterReportTransactions(
        transactions,
        range,
        filters,
        categories,
        account.id,
      ),
      { from: new Date(2026, 0, 1), to: new Date(2026, 0, 15) },
    );

    expect(result.budget).toBe(300);
    expect(result.actual).toBe(1_250);
    expect(result.remaining).toBe(-950);
    expect(result.rows.find((row) => row.budgetId === "food-budget")?.actual).toBe(250);
    expect(result.rows.find((row) => row.isUnbudgeted)?.actual).toBe(1_000);
  });

  it("removes excluded categories from budget cards and rows", () => {
    const budgets: Budget[] = [
      {
        id: "food-budget",
        categoryId: "food",
        amount: 310,
        period: "monthly",
        year: 2026,
      },
      {
        id: "housing-budget",
        categoryId: "housing",
        amount: 1_550,
        period: "monthly",
        year: 2026,
      },
    ];
    const reportFilters = {
      ...filters,
      excludedCategoryKeys: ["expense:housing"],
    };
    const report = computeReportAnalytics(
      transactions,
      range,
      reportFilters,
      categories,
      [account],
      "month",
      account.id,
    );
    const result = computeReportBudgets(
      budgets,
      categories,
      report.transactions,
      range,
      reportFilters,
    );

    expect(result.rows.map((row) => row.categoryName)).toEqual(["Food"]);
    expect(result.budget).toBe(310);
    expect(result.actual).toBe(250);
    expect(result.remaining).toBe(60);
  });

  it("counts nested budget expenses once and reconciles unbudgeted spending", () => {
    const nestedBudgets: Budget[] = [
      {
        id: "housing-budget",
        categoryId: "housing",
        amount: 1_550,
        period: "monthly",
        year: 2026,
      },
      {
        id: "rent-budget",
        categoryId: "rent",
        amount: 1_000,
        period: "monthly",
        year: 2026,
      },
    ];
    const nestedTransactions = [
      transaction("rent", "2026-01-03", 1_000, "expense", "Rent", {
        categoryId: "rent",
      }),
      transaction("housing", "2026-01-04", 200, "expense", "Housing", {
        categoryId: "housing",
      }),
      transaction("food", "2026-01-05", 250, "expense", "Food", {
        categoryId: "food",
      }),
    ];
    const report = computeReportAnalytics(
      nestedTransactions,
      range,
      filters,
      categories,
      [account],
      "month",
      account.id,
    );
    const result = computeReportBudgets(
      nestedBudgets,
      categories,
      report.transactions,
      range,
      filters,
    );

    expect(result.actual).toBe(report.summary.expenses);
    expect(result.actual).toBe(1_450);
    expect(result.rows.find((row) => row.budgetId === "rent-budget")?.actual).toBe(1_000);
    expect(result.rows.find((row) => row.budgetId === "housing-budget")?.actual).toBe(200);
    expect(
      result.rows.find((row) => row.isUnbudgeted),
    ).toMatchObject({
      categoryName: "Unbudgeted expenses",
      budget: 0,
      actual: 250,
      remaining: -250,
    });
    expect(result.rows.reduce((sum, row) => sum + row.actual, 0)).toBe(
      report.summary.expenses,
    );
  });

  it("matches Compare exactly for the same posted date range and filters", () => {
    const comparisonRanges = buildComparisonDateRanges({
      preset: "custom-dates",
      primaryYear: 2026,
      comparisonYear: 2025,
      primaryStartDate: range.from,
      primaryEndDate: range.to,
    });
    const comparison = computeYearComparison(
      transactions,
      2026,
      2025,
      comparisonRanges,
      categories,
      ["expense:housing"],
    );
    const report = computeReportAnalytics(
      transactions,
      range,
      { ...filters, excludedCategoryKeys: ["expense:housing"] },
      categories,
      [account],
      "month",
      account.id,
    );

    expect(report.summary).toMatchObject({
      income: comparison.primary.income,
      expenses: comparison.primary.expenses,
      net: comparison.primary.net,
      transactionCount: comparison.primary.transactionCount,
      savingsRate: comparison.primary.savingsRate,
    });
  });
});
