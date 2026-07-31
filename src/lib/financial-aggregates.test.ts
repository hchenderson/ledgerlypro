import { describe, expect, it } from "vitest";

import { buildFinancialAggregateDocuments } from "./financial-aggregates";
import type { Transaction } from "@/types";

const transactions: Transaction[] = [
  {
    id: "income",
    date: "2026-01-05T12:00:00.000Z",
    description: "Paycheck",
    amount: 2_500,
    type: "income",
    category: "Income",
    accountId: "checking",
  },
  {
    id: "expense",
    date: "2026-01-08T12:00:00.000Z",
    description: "Rent",
    amount: -1_000,
    type: "expense",
    category: "Housing",
    accountId: "checking",
  },
  {
    id: "transfer-out",
    date: "2026-01-10T12:00:00.000Z",
    description: "Move to savings",
    amount: 200,
    type: "transfer",
    category: "Transfer",
    accountId: "checking",
    transferId: "transfer-1",
    transferDirection: "out",
  },
  {
    id: "transfer-in",
    date: "2026-01-10T12:00:00.000Z",
    description: "Move to savings",
    amount: 200,
    type: "transfer",
    category: "Transfer",
    accountId: "savings",
    transferId: "transfer-1",
    transferDirection: "in",
  },
  {
    id: "other-year",
    date: "2025-12-31T12:00:00.000Z",
    description: "Prior year",
    amount: 99,
    type: "expense",
    category: "Other",
  },
];

describe("buildFinancialAggregateDocuments", () => {
  it("builds one yearly and twelve monthly summaries", () => {
    const documents = buildFinancialAggregateDocuments(transactions, 2026);

    expect(documents).toHaveLength(13);
    expect(documents[0]).toMatchObject({
      id: "year-2026",
      income: 2_500,
      expenses: 1_000,
      net: 1_500,
      balanceChange: 1_500,
      transactionCount: 2,
    });
    expect(documents[1]).toMatchObject({
      id: "month-2026-01",
      income: 2_500,
      expenses: 1_000,
      net: 1_500,
      balanceChange: 1_500,
      transactionCount: 2,
    });
    expect(documents[2]).toMatchObject({
      id: "month-2026-02",
      income: 0,
      expenses: 0,
      transactionCount: 0,
    });
  });

  it("tracks transfers in account balances without changing cash-flow metrics", () => {
    const checkingDocuments = buildFinancialAggregateDocuments(
      transactions,
      2026,
      "checking",
    );
    const savingsDocuments = buildFinancialAggregateDocuments(
      transactions,
      2026,
      "savings",
    );

    expect(checkingDocuments[0]).toMatchObject({
      id: "account-checking-year-2026",
      accountId: "checking",
      income: 2_500,
      expenses: 1_000,
      net: 1_500,
      balanceChange: 1_300,
      transactionCount: 2,
    });
    expect(savingsDocuments[0]).toMatchObject({
      id: "account-savings-year-2026",
      accountId: "savings",
      income: 0,
      expenses: 0,
      net: 0,
      balanceChange: 200,
      transactionCount: 0,
    });
  });
});
