import { endOfDay, startOfDay } from "date-fns";

import {
  parseTransactionDate,
  summarizeTransactions,
  transactionAmount,
  type FinancialDateRange,
} from "@/lib/financial-summary";
import { expandTransactionsForReporting } from "@/lib/transaction-allocations";
import type { DesignatedFund, Transaction } from "@/types";
import { isFinancialTransaction } from "@/lib/accounts";

export interface DesignatedFundResult {
  fund: DesignatedFund;
  openingBalance: number;
  received: number;
  spent: number;
  change: number;
  endingBalance: number;
}

function inRange(date: Date, range: FinancialDateRange) {
  return (
    date.getTime() >= startOfDay(range.from).getTime() &&
    date.getTime() <= endOfDay(range.to).getTime()
  );
}

function movement(
  transaction: Transaction,
  fund: DesignatedFund,
): number {
  if (!isFinancialTransaction(transaction)) return 0;
  if (
    transaction.type === "income" &&
    transaction.categoryId &&
    fund.incomeCategoryIds.includes(transaction.categoryId)
  ) {
    return transactionAmount(transaction);
  }
  if (
    transaction.type === "expense" &&
    transaction.categoryId &&
    fund.expenseCategoryIds.includes(transaction.categoryId)
  ) {
    return -transactionAmount(transaction);
  }
  return 0;
}

export function computeDesignatedFundResult(
  fund: DesignatedFund,
  transactions: Transaction[],
  range: FinancialDateRange,
): DesignatedFundResult {
  const entries = expandTransactionsForReporting(transactions);
  const fundStart = startOfDay(new Date(fund.openingBalanceDate)).getTime();
  const reportStart = startOfDay(range.from).getTime();
  const openingBalance = entries.reduce((balance, transaction) => {
    const date = parseTransactionDate(transaction.date);
    if (!date || date.getTime() < fundStart || date.getTime() >= reportStart) {
      return balance;
    }
    return balance + movement(transaction, fund);
  }, fundStart <= reportStart ? fund.openingBalance : 0);

  let received = 0;
  let spent = 0;
  for (const transaction of entries) {
    const date = parseTransactionDate(transaction.date);
    if (!date || date.getTime() < fundStart || !inRange(date, range)) continue;
    const value = movement(transaction, fund);
    if (value > 0) received += value;
    if (value < 0) spent += Math.abs(value);
  }
  return {
    fund,
    openingBalance,
    received,
    spent,
    change: received - spent,
    endingBalance: openingBalance + received - spent,
  };
}

export function computeOperatingSummary(
  funds: DesignatedFund[],
  transactions: Transaction[],
  range: FinancialDateRange,
) {
  const designatedIncome = new Set(funds.flatMap((fund) => fund.incomeCategoryIds));
  const designatedExpense = new Set(funds.flatMap((fund) => fund.expenseCategoryIds));
  const operatingEntries = expandTransactionsForReporting(transactions).filter(
    (transaction) => {
      const date = parseTransactionDate(transaction.date);
      if (!date || !inRange(date, range)) return false;
      if (transaction.type === "income") {
        return !transaction.categoryId || !designatedIncome.has(transaction.categoryId);
      }
      if (transaction.type === "expense") {
        return !transaction.categoryId || !designatedExpense.has(transaction.categoryId);
      }
      return false;
    },
  );
  return summarizeTransactions(operatingEntries);
}
