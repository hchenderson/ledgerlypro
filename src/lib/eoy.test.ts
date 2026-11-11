import { describe, expect, it } from "vitest";

import { computeEOYReport } from "./eoy";
import type { Category, Transaction } from "@/types";

const transactions: Transaction[] = [
  {
    id: "income",
    date: "2025-01-05T12:00:00.000Z",
    description: "Legacy income",
    amount: -1_000,
    type: "income",
    category: "Salary",
  },
  {
    id: "expense",
    date: "2025-01-06T12:00:00.000Z",
    description: "Legacy expense",
    amount: -250,
    type: "expense",
    category: "Uncategorized",
  },
  {
    id: "transfer-out",
    date: "2025-01-07T12:00:00.000Z",
    description: "Move money",
    amount: 100,
    type: "transfer",
    category: "Transfer",
    transferDirection: "out",
  },
];

describe("computeEOYReport", () => {
  it("reconciles cash flow and keeps account transfers balance-only", () => {
    const report = computeEOYReport(transactions, [], 2025);

    expect(report.totalIncome).toBe(1_000);
    expect(report.totalExpenses).toBe(250);
    expect(report.net).toBe(750);
    expect(report.monthly[0]).toMatchObject({
      income: 1_000,
      expenses: 250,
      net: 750,
      transferNet: -100,
      balanceChange: 650,
    });
  });

  it("uses stable category IDs and reconciles renamed, duplicate, unresolved, and uncategorized rows", () => {
    const categoryTree: Category[] = [
      {
        id: "operations",
        name: "Operations",
        type: "expense",
        subCategories: [{ id: "ops-meals", name: "Meals" }],
      },
      {
        id: "ministry",
        name: "Ministry",
        type: "expense",
        subCategories: [{ id: "ministry-meals", name: "Meals" }],
      },
    ];
    const report = computeEOYReport(
      [
        { ...transactions[1], id: "renamed", amount: 100, categoryId: "ops-meals", category: "Old meals name" },
        { ...transactions[1], id: "duplicate-name", amount: 200, categoryId: "ministry-meals", category: "Meals" },
        { ...transactions[1], id: "deleted", amount: 50, categoryId: "deleted-category", category: "Former program" },
        { ...transactions[1], id: "uncategorized", amount: 25, category: "Uncategorized" },
      ],
      categoryTree,
      2025,
    );

    expect(report.totalExpenses).toBe(375);
    expect(report.categories.map((row) => [row.key, row.name, row.total])).toEqual(
      expect.arrayContaining([
        ["expense:ops-meals", "Operations > Meals", 100],
        ["expense:ministry-meals", "Ministry > Meals", 200],
        ["expense:unresolved-id:deleted-category", "Unresolved · Former program", 50],
        ["expense:uncategorized", "Uncategorized", 25],
      ]),
    );
    expect(report.categories.reduce((sum, row) => sum + row.total, 0)).toBe(375);
    expect(report.categories.reduce((sum, row) => sum + row.percentageOfTotal, 0)).toBeCloseTo(100);
  });
});
