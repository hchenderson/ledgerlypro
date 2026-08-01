import { describe, expect, it } from "vitest";

import {
  buildAccountBalanceTimeline,
  buildAccountLedger,
  buildTransferTransactions,
  calculateAccountBalance,
  calculateAccountBalanceAsOf,
  ledgerBalanceToStatementBalance,
  normalizeOpeningBalance,
  statementBalanceToLedgerBalance,
} from "./accounts";
import { summarizeTransactions } from "./financial-summary";
import type { Account } from "@/types";

const checking: Account = {
  id: "checking",
  name: "Checking",
  type: "checking",
  classification: "asset",
  openingBalance: 1_000,
  currency: "USD",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const savings: Account = {
  ...checking,
  id: "savings",
  name: "Savings",
  openingBalance: 500,
};

describe("multi-account balances", () => {
  it("stores credit-card opening balances as liabilities", () => {
    expect(normalizeOpeningBalance("credit", 750)).toBe(-750);
    expect(normalizeOpeningBalance("checking", 750)).toBe(750);
  });

  it("keeps legacy unassigned transactions in the primary account", () => {
    expect(
      calculateAccountBalance(
        { ...checking, isDefault: true },
        [
          {
            id: "legacy",
            date: "2025-01-01T00:00:00.000Z",
            description: "Legacy expense",
            amount: 100,
            type: "expense",
            category: "Other",
          },
        ],
      ),
    ).toBe(900);
  });

  it("moves money without creating income or expense", () => {
    const [outgoing, incoming] = buildTransferTransactions({
      input: {
        sourceAccountId: checking.id,
        destinationAccountId: savings.id,
        amount: 200,
        date: "2026-03-01T00:00:00.000Z",
      },
      transferId: "transfer-1",
      outgoingId: "out",
      incomingId: "in",
    });

    expect(
      calculateAccountBalance(checking, [outgoing, incoming]),
    ).toBe(800);
    expect(
      calculateAccountBalance(savings, [outgoing, incoming]),
    ).toBe(700);
    expect(summarizeTransactions([outgoing, incoming])).toEqual({
      income: 0,
      expenses: 0,
      net: 0,
      transactionCount: 0,
    });
  });

  it("calculates statement-date balances and running ledger values", () => {
    const transactions = [
      {
        id: "income",
        date: "2026-01-02T12:00:00.000Z",
        description: "Paycheck",
        amount: 500,
        type: "income" as const,
        category: "Salary",
        accountId: checking.id,
      },
      {
        id: "expense",
        date: "2026-01-03T12:00:00.000Z",
        description: "Groceries",
        amount: 125,
        type: "expense" as const,
        category: "Groceries",
        accountId: checking.id,
      },
      {
        id: "later",
        date: "2026-02-01T12:00:00.000Z",
        description: "Utilities",
        amount: 75,
        type: "expense" as const,
        category: "Utilities",
        accountId: checking.id,
      },
    ];

    expect(
      calculateAccountBalanceAsOf(
        checking,
        transactions,
        "2026-01-31",
      ),
    ).toBe(1_375);
    expect(
      buildAccountLedger(checking, transactions).map((entry) => [
        entry.transaction.id,
        entry.runningBalance,
      ]),
    ).toEqual([
      ["later", 1_300],
      ["expense", 1_375],
      ["income", 1_500],
    ]);
    expect(
      buildAccountBalanceTimeline(
        checking,
        transactions,
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
      ),
    ).toEqual([
      { date: "2026-01-01", balance: 1_000 },
      { date: "2026-01-02", balance: 1_500 },
      { date: "2026-01-03", balance: 1_375 },
      { date: "2026-01-31", balance: 1_375 },
    ]);
  });

  it("converts credit-card statement amounts without losing credits", () => {
    const creditAccount: Account = {
      ...checking,
      type: "credit",
      classification: "liability",
      openingBalance: -500,
    };

    expect(
      statementBalanceToLedgerBalance(creditAccount, 425),
    ).toBe(-425);
    expect(
      statementBalanceToLedgerBalance(creditAccount, -25),
    ).toBe(25);
    expect(
      ledgerBalanceToStatementBalance(creditAccount, -425),
    ).toBe(425);
  });
});
