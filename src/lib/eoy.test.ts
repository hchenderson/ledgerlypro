import { describe, expect, it } from "vitest";

import { computeEOYReport } from "./eoy";
import type { Transaction } from "@/types";

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
});
