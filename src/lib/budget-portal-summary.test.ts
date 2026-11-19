import { beforeAll, describe, expect, it, vi } from "vitest";

import type { Budget, Category, Transaction } from "@/types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/firebaseAdmin", () => ({ adminDb: null }));

let calculatePortalBudgetSummaries: typeof import("./budget-portal-summary").calculatePortalBudgetSummaries;

const categories: Category[] = [{
  id: "operations",
  name: "Operations",
  type: "expense",
  subCategories: [{ id: "supplies", name: "Supplies" }],
}];

const budgets: Budget[] = [
  { id: "parent", categoryId: "operations", amount: 1000, amountMinor: 100000, currency: "USD", period: "yearly", year: 2026 },
  { id: "child", categoryId: "supplies", amount: 200, amountMinor: 20000, currency: "USD", period: "yearly", year: 2026 },
];

const transaction = (id: string, amountMinor: number, overrides: Partial<Transaction> = {}): Transaction => ({
  id,
  date: "2026-06-15",
  ledgerDate: "2026-06-15",
  description: id,
  amount: amountMinor / 100,
  amountMinor,
  currency: "USD",
  type: "expense",
  category: "Supplies",
  categoryId: "supplies",
  accountId: "checking",
  source: "actual",
  postingStatus: "posted",
  ...overrides,
});

beforeAll(async () => {
  ({ calculatePortalBudgetSummaries } = await import("./budget-portal-summary"));
});

describe("Budget Portal canonical totals", () => {
  it("matches owner budget semantics for splits, refunds, finalized status, and nested overlap", () => {
    const transactions: Transaction[] = [
      transaction("ordinary", 10000),
      transaction("refund", 2000, { type: "income", refundOfTransactionId: "ordinary", refundStatus: "confirmed" }),
      transaction("split", 10000, {
        category: "Split",
        categoryId: undefined,
        allocations: [
          { id: "supplies-line", amount: 50, amountMinor: 5000, category: "Supplies", categoryId: "supplies" },
          { id: "other-line", amount: 50, amountMinor: 5000, category: "Other", categoryId: "other" },
        ],
      }),
      transaction("pending", 99900, { postingStatus: "pending" }),
      transaction("removed", 99900, { postingStatus: "removed" }),
      transaction("possible-transfer", 99900, { possibleTransfer: true }),
      transaction("transfer", 99900, { type: "transfer", transferDirection: "out" }),
    ];
    const result = calculatePortalBudgetSummaries({
      budgets,
      transactions,
      categories,
      assignedBudgetIds: ["parent", "child", "deleted"],
      reportingTimeZone: "America/New_York",
      now: new Date("2026-06-30T12:00:00.000Z"),
    });
    expect(result.unavailableAssignments).toBe(1);
    expect(result.budgets).toHaveLength(2);
    expect(result.budgets[0]).toMatchObject({
      budgetedMinor: 100000,
      spendingMinor: 13000,
      remainingMinor: 87000,
      overlapsOtherAssignedBudget: true,
    });
    expect(result.budgets[1]).toMatchObject({
      budgetedMinor: 20000,
      spendingMinor: 13000,
      remainingMinor: 7000,
      overlapsOtherAssignedBudget: true,
    });
    expect(result.budgets[0].categoryBreakdown.reduce((sum, line) => sum + line.spendingMinor, 0)).toBe(13000);
  });

  it("uses the selected monthly period and handles zero and negative net spending", () => {
    const monthly: Budget = { id: "monthly", categoryId: "supplies", amount: 0, amountMinor: 0, currency: "USD", period: "monthly", year: 2026 };
    const result = calculatePortalBudgetSummaries({
      budgets: [monthly],
      transactions: [
        transaction("may", 5000, { date: "2026-05-31", ledgerDate: "2026-05-31" }),
        transaction("june-refund", 7000, { type: "income", refundOfTransactionId: "older", refundStatus: "confirmed" }),
      ],
      categories,
      assignedBudgetIds: ["monthly"],
      reportingTimeZone: "America/New_York",
      now: new Date("2026-06-01T04:30:00.000Z"),
    });
    expect(result.budgets[0]).toMatchObject({
      periodLabel: "June 2026",
      budgetedMinor: 0,
      spendingMinor: -7000,
      remainingMinor: 7000,
      percentageUsed: null,
      overBudget: false,
    });
  });
});
