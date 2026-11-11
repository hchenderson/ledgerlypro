import type { Transaction } from "@/types";
import { isFinancialTransaction } from "@/lib/accounts";
import { isTransactionFinalized } from "@/lib/categorization";
import {
  expandTransactionsForReporting,
  sourceTransactionId,
} from "@/lib/transaction-allocations";
import { ledgerDateToDate, transactionLedgerDate } from "@/lib/ledger-date";
import { minorToMajor, moneyMinor } from "@/lib/money";

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
  try {
    return ledgerDateToDate(transactionLedgerDate({ date: value }));
  } catch {
    return null;
  }
}

export function transactionAmount(transaction: Pick<Transaction, "amount" | "amountMinor" | "currency">): number {
  return minorToMajor(moneyMinor(transaction));
}

/** Signed reporting effect. Linked refunds reduce expense; they never become income. */
export function financialTransactionAmount(
  transaction: Pick<Transaction, "amount" | "amountMinor" | "currency" | "refundOfTransactionId" | "refundStatus">,
): number {
  const amount = transactionAmount(transaction);
  return transaction.refundOfTransactionId && transaction.refundStatus === "confirmed" ? -amount : amount;
}

/**
 * Returns the canonical reporting lines for finalized financial activity.
 *
 * Account scope is intentionally supplied by the caller through `transactions`.
 * Pending, removed, possible-transfer, and transfer records are excluded. Split
 * allocations are expanded for reporting while the source transaction remains
 * the only record used by account-balance calculations.
 */
export function financialReportingTransactions(
  transactions: Transaction[],
): Transaction[] {
  return expandTransactionsForReporting(transactions).filter(
    isFinancialTransaction,
  );
}

export function filterTransactionsByDateRange(
  transactions: Transaction[],
  range?: FinancialDateRange
): Transaction[] {
  if (!range) return transactions.filter(isTransactionFinalized);

  const from = `${range.from.getFullYear()}-${String(range.from.getMonth() + 1).padStart(2, "0")}-${String(range.from.getDate()).padStart(2, "0")}`;
  const to = `${range.to.getFullYear()}-${String(range.to.getMonth() + 1).padStart(2, "0")}-${String(range.to.getDate()).padStart(2, "0")}`;

  return transactions.filter((transaction) => {
    if (!isTransactionFinalized(transaction)) return false;
    try {
      const date = transactionLedgerDate(transaction);
      return date >= from && date <= to;
    } catch {
      return false;
    }
  });
}

export function summarizeTransactions(
  transactions: Transaction[]
): FinancialSummary {
  let income = 0;
  let expenses = 0;
  const sourceTransactions = new Set<string>();

  for (const transaction of financialReportingTransactions(transactions)) {
    const amount = financialTransactionAmount(transaction);
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
