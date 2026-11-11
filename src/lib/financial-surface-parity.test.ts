import { describe, expect, it } from "vitest";

import { computeYearComparison } from "@/lib/comparison-analytics";
import { computeDashboardAnalytics } from "@/lib/dashboard-analytics";
import { computeEOYReport } from "@/lib/eoy";
import { buildReportCsvRows, summarizeReportCsvRows } from "@/lib/report-export";
import { calculateQuarterlyReportMetrics } from "@/lib/quarterly-report";
import { computeReportAnalytics } from "@/lib/report-analytics";
import type { Category, Transaction } from "@/types";

const range = {
  from: new Date(2026, 0, 1),
  to: new Date(2026, 2, 31, 23, 59, 59, 999),
};
const categories: Category[] = [
  { id: "giving", name: "Giving", type: "income" },
  { id: "designated", name: "Designated", type: "income" },
  {
    id: "operations",
    name: "Operations",
    type: "expense",
    subCategories: [
      { id: "supplies", name: "Supplies" },
      { id: "fees", name: "Fees" },
    ],
  },
];
const transaction = (
  id: string,
  amount: number,
  type: Transaction["type"],
  extras: Partial<Transaction> = {},
): Transaction => ({
  id,
  date: "2026-02-15T12:00:00.000Z",
  description: id,
  amount,
  type,
  category: "Uncategorized",
  accountId: "checking",
  ...extras,
});
const allTransactions: Transaction[] = [
  transaction("giving", 1_000, "income", { category: "Giving", categoryId: "giving" }),
  transaction("designated", 200, "income", { category: "Designated", categoryId: "designated" }),
  transaction("split-expense", 120, "expense", {
    category: "Split",
    allocations: [
      { id: "split-supplies", amount: 70, category: "Supplies", categoryId: "supplies" },
      { id: "split-fees", amount: 50, category: "Fees", categoryId: "fees" },
    ],
  }),
  transaction("recurring-actual", 103, "expense", {
    category: "Supplies",
    categoryId: "supplies",
    source: "plaid",
    recurringOccurrenceId: "rent::2026-02-01",
  }),
  transaction("legacy-expectation", 100, "expense", {
    category: "Supplies",
    categoryId: "supplies",
    source: "recurring",
    recurringExpectationOnly: true,
  }),
  transaction("pending", 900, "expense", { postingStatus: "pending", categoryId: "supplies" }),
  transaction("removed", 800, "expense", { postingStatus: "removed", categoryId: "supplies" }),
  transaction("possible-transfer", 700, "expense", { possibleTransfer: true, categoryId: "supplies" }),
  transaction("transfer", 300, "transfer", { transferDirection: "out", category: "Transfer" }),
  transaction("other-account", 50, "expense", { accountId: "savings", categoryId: "supplies" }),
];
const checkingTransactions = allTransactions.filter(
  (item) => item.accountId === "checking",
);

describe("financial surface parity", () => {
  it("agrees across Reports, Compare, Dashboard, Quarterly, Year-End, and CSV for equivalent scope", () => {
    const filters = {
      accountIds: ["checking"],
      transactionTypes: ["income", "expense"] as ("income" | "expense")[],
      includedCategoryKeys: [],
      excludedCategoryKeys: [],
      includePending: false,
      includeTransfers: false,
    };
    const report = computeReportAnalytics(
      allTransactions,
      range,
      filters,
      categories,
      [],
      "month",
    );
    const compare = computeYearComparison(
      checkingTransactions,
      2026,
      2025,
      {
        primary: range,
        comparison: { from: new Date(2025, 0, 1), to: new Date(2025, 2, 31) },
      },
      categories,
    );
    const dashboard = computeDashboardAnalytics(
      checkingTransactions,
      0,
      new Date(2026, 2, 31),
      new Date(2026, 2, 31),
      categories,
    );
    const quarterly = calculateQuarterlyReportMetrics({
      transactions: allTransactions,
      categories,
      budgets: [],
      goals: [],
      reportYear: 2026,
      range,
      accountIds: ["checking"],
    });
    const yearEnd = computeEOYReport(checkingTransactions, categories, 2026);
    const csv = summarizeReportCsvRows(
      buildReportCsvRows(report.financialTransactions, () => "Checking"),
    );
    const expected = { income: 1_200, expenses: 223, net: 977 };

    expect(report.summary).toMatchObject(expected);
    expect(compare.primary).toMatchObject(expected);
    expect(dashboard).toMatchObject({ totalIncome: 1_200, totalExpenses: 223 });
    expect(quarterly).toMatchObject({ totalIncome: 1_200, totalExpenses: 223, netIncome: 977 });
    expect(yearEnd).toMatchObject({ totalIncome: 1_200, totalExpenses: 223, net: 977 });
    expect(csv).toEqual(expected);
    expect(yearEnd.categories.reduce((sum, row) => sum + row.total, 0)).toBe(223);
  });
});
