import { endOfDay, parseISO, startOfDay } from "date-fns";

import type { Transaction } from "@/types";
import { isFinancialTransaction } from "@/lib/accounts";
import { isTransactionFinalized } from "@/lib/categorization";
import {
  expandTransactionsForReporting,
  sourceTransactionId,
} from "@/lib/transaction-allocations";

export interface FinancialDateRange {
  from: Date;
  to: Date;
}

export interface FinancialSummary {
  income: number;
  expenses: number;
  net: number;
  transactionCount: number;
}

export function parseTransactionDate(value: string): Date | null {
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function transactionAmount(transaction: Pick<Transaction, "amount">): number {
  return Number.isFinite(transaction.amount) ? Math.abs(transaction.amount) : 0;
}

export function filterTransactionsByDateRange(
  transactions: Transaction[],
  range?: FinancialDateRange
): Transaction[] {
  if (!range) return transactions.filter(isTransactionFinalized);

  const from = startOfDay(range.from).getTime();
  const to = endOfDay(range.to).getTime();

  return transactions.filter((transaction) => {
    if (!isTransactionFinalized(transaction)) return false;
    const date = parseTransactionDate(transaction.date);
    if (!date) return false;
    const timestamp = date.getTime();
    return timestamp >= from && timestamp <= to;
  });
}

export function summarizeTransactions(
  transactions: Transaction[]
): FinancialSummary {
  let income = 0;
  let expenses = 0;
  const sourceTransactions = new Set<string>();

  for (const transaction of expandTransactionsForReporting(transactions)) {
    if (!isFinancialTransaction(transaction)) continue;
    const amount = transactionAmount(transaction);
    if (transaction.type === "income") {
      income += amount;
    } else if (transaction.type === "expense") {
      expenses += amount;
    }
    sourceTransactions.add(sourceTransactionId(transaction));
  }

  return {
    income,
    expenses,
    net: income - expenses,
    transactionCount: sourceTransactions.size,
  };
}
