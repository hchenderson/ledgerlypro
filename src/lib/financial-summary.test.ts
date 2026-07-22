import { describe, expect, it } from "vitest";

import {
  filterTransactionsByDateRange,
  summarizeTransactions,
} from "./financial-summary";
import type { Transaction } from "@/types";

const transaction = (
  id: string,
  date: string,
  amount: number,
  type: Transaction["type"]
): Transaction => ({ id, date, amount, type, category: "General", description: id });

describe("financial summary", () => {
  it("includes the entire selected ending day", () => {
    const transactions = [
      transaction("morning", "2026-07-21T08:00:00.000-04:00", 10, "expense"),
      transaction("evening", "2026-07-21T22:00:00.000-04:00", 20, "expense"),
      transaction("tomorrow", "2026-07-22T08:00:00.000-04:00", 30, "expense"),
    ];

    const filtered = filterTransactionsByDateRange(transactions, {
      from: new Date(2026, 6, 21),
      to: new Date(2026, 6, 21),
    });

    expect(filtered.map((item) => item.id)).toEqual(["morning", "evening"]);
  });

  it("uses transaction type for direction and normalizes legacy signed amounts", () => {
    const summary = summarizeTransactions([
      transaction("income", "2026-01-01", -1_000, "income"),
      transaction("expense", "2026-01-02", -250, "expense"),
    ]);

    expect(summary).toEqual({
      income: 1_000,
      expenses: 250,
      net: 750,
      transactionCount: 2,
    });
  });
});
