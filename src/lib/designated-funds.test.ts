import { describe, expect, it } from "vitest";
import type { DesignatedFund, Transaction } from "@/types";
import {
  computeDesignatedFundResult,
  computeOperatingSummary,
} from "./designated-funds";

const fund: DesignatedFund = {
  id: "missions",
  name: "Missionary Support",
  incomeCategoryIds: ["mission-in"],
  expenseCategoryIds: ["mission-out"],
  openingBalance: 700,
  openingBalanceDate: "2025-01-01T00:00:00.000Z",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const transactions: Transaction[] = [
  {
    id: "deposit",
    date: "2026-02-01T12:00:00.000Z",
    description: "Combined deposit",
    amount: 2_000,
    type: "income",
    category: "Split transaction",
    allocations: [
      { id: "general", amount: 1_550, category: "General Giving", categoryId: "general" },
      { id: "mission", amount: 450, category: "Mission Support", categoryId: "mission-in" },
    ],
  },
  { id: "sent", date: "2026-03-01T12:00:00.000Z", description: "Mission payment", amount: 300, type: "expense", category: "Mission Sent", categoryId: "mission-out" },
  { id: "utilities", date: "2026-03-02T12:00:00.000Z", description: "Utilities", amount: 500, type: "expense", category: "Utilities", categoryId: "utilities" },
];

const range = { from: new Date(2026, 0, 1), to: new Date(2026, 11, 31) };

describe("designated fund reporting", () => {
  it("reconciles opening, received, spent, and ending balances", () => {
    expect(computeDesignatedFundResult(fund, transactions, range)).toMatchObject({
      openingBalance: 700,
      received: 450,
      spent: 300,
      change: 150,
      endingBalance: 850,
    });
  });

  it("removes only designated allocations from church operations", () => {
    expect(computeOperatingSummary([fund], transactions, range)).toMatchObject({
      income: 1_550,
      expenses: 500,
      net: 1_050,
    });
  });
});
