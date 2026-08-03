import type { Transaction } from "@/types";
import {
  summarizeTransactions,
  transactionAmount,
} from "@/lib/financial-summary";
import { transferBalanceDelta } from "@/lib/accounts";

export const FINANCIAL_AGGREGATE_VERSION = 2;

export type FinancialAggregatePeriod = "year" | "month";

export interface FinancialAggregateDocument {
  id: string;
  version: number;
  period: FinancialAggregatePeriod;
  year: number;
  month?: number;
  accountId?: string;
  income: number;
  expenses: number;
  net: number;
  balanceChange: number;
  transactionCount: number;
  sourceFingerprint: string;
}

export function financialAggregateId(
  year: number,
  month?: number,
  accountId?: string,
): string {
  const periodId = month === undefined
    ? `year-${year}`
    : `month-${year}-${String(month + 1).padStart(2, "0")}`;
  return accountId
    ? `account-${accountId}-${periodId}`
    : periodId;
}

function fingerprintTransactions(transactions: Transaction[]): string {
  let hash = 2166136261;
  const sorted = [...transactions].sort((a, b) => a.id.localeCompare(b.id));

  for (const transaction of sorted) {
    const value = [
      transaction.id,
      transaction.date,
      transaction.type,
      transaction.accountId ?? "",
      transaction.transferDirection ?? "",
      transaction.postingStatus ?? "posted",
      transaction.providerRemovedAt ?? "",
      transactionAmount(transaction).toFixed(2),
      transaction.categoryId ?? transaction.category,
    ].join("|");

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }

  return `${transactions.length}:${(hash >>> 0).toString(36)}`;
}

function makeAggregate(
  transactions: Transaction[],
  year: number,
  month?: number,
  accountId?: string,
): FinancialAggregateDocument {
  const summary = summarizeTransactions(transactions);
  const transferNet = transactions.reduce(
    (total, transaction) =>
      total + transferBalanceDelta(transaction),
    0,
  );

  return {
    id: financialAggregateId(year, month, accountId),
    version: FINANCIAL_AGGREGATE_VERSION,
    period: month === undefined ? "year" : "month",
    year,
    ...(month === undefined ? {} : { month }),
    ...(accountId ? { accountId } : {}),
    income: summary.income,
    expenses: summary.expenses,
    net: summary.net,
    balanceChange: summary.net + transferNet,
    transactionCount: summary.transactionCount,
    sourceFingerprint: fingerprintTransactions(transactions),
  };
}

export function buildFinancialAggregateDocuments(
  transactions: Transaction[],
  year: number,
  accountId?: string,
): FinancialAggregateDocument[] {
  const transactionsForYear = transactions.filter((transaction) => {
    const date = new Date(transaction.date);
    return (
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === year &&
      (!accountId || transaction.accountId === accountId)
    );
  });

  const monthlyTransactions = Array.from(
    { length: 12 },
    () => [] as Transaction[],
  );

  for (const transaction of transactionsForYear) {
    const month = new Date(transaction.date).getMonth();
    if (month >= 0 && month <= 11) {
      monthlyTransactions[month].push(transaction);
    }
  }

  return [
    makeAggregate(transactionsForYear, year, undefined, accountId),
    ...monthlyTransactions.map((monthTransactions, month) =>
      makeAggregate(
        monthTransactions,
        year,
        month,
        accountId,
      ),
    ),
  ];
}
