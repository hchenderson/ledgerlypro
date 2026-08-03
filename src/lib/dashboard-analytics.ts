import { format, getMonth, getYear, parseISO, subMonths } from "date-fns";

import type { Transaction } from "@/types";
import { transferBalanceDelta } from "@/lib/accounts";
import { transactionAmount } from "@/lib/financial-summary";
import { isTransactionFinalized } from "@/lib/categorization";
import { isFinancialTransaction } from "@/lib/accounts";

export interface DashboardAnalytics {
  totalIncome: number;
  totalExpenses: number;
  currentBalance: number;
  overviewData: Array<{ name: string; income: number; expense: number }>;
  currentMonthIncome: number;
  currentMonthExpenses: number;
  previousMonthIncome: number;
  previousMonthExpenses: number;
  savingsRate: number;
}

export function computeDashboardAnalytics(
  transactions: Transaction[],
  startingBalanceForYear: number,
  referenceDate: Date
): DashboardAnalytics {
  const previousMonthDate = subMonths(referenceDate, 1);
  const referenceMonth = getMonth(referenceDate);
  const referenceYear = getYear(referenceDate);
  const previousMonth = getMonth(previousMonthDate);
  const previousMonthYear = getYear(previousMonthDate);

  let totalIncome = 0;
  let totalExpenses = 0;
  let currentMonthIncome = 0;
  let currentMonthExpenses = 0;
  let previousMonthIncome = 0;
  let previousMonthExpenses = 0;
  let transferNet = 0;

  const monthlyData = new Map<
    string,
    { date: Date; name: string; income: number; expense: number }
  >();

  for (const transaction of transactions) {
    if (!isTransactionFinalized(transaction)) continue;
    const transactionDate = parseISO(transaction.date);
    if (Number.isNaN(transactionDate.getTime())) continue;
    const amount = transactionAmount(transaction);

    if (transaction.type === "transfer") {
      transferNet += transferBalanceDelta(transaction);
      continue;
    }
    if (!isFinancialTransaction(transaction)) continue;

    if (transaction.type === "income") totalIncome += amount;
    else if (transaction.type === "expense") {
      totalExpenses += amount;
    }

    const transactionMonth = getMonth(transactionDate);
    const transactionYear = getYear(transactionDate);

    if (transactionYear === referenceYear && transactionMonth === referenceMonth) {
      if (transaction.type === "income") currentMonthIncome += amount;
      else if (transaction.type === "expense") {
        currentMonthExpenses += amount;
      }
    }

    if (
      transactionYear === previousMonthYear &&
      transactionMonth === previousMonth
    ) {
      if (transaction.type === "income") previousMonthIncome += amount;
      else if (transaction.type === "expense") {
        previousMonthExpenses += amount;
      }
    }

    const monthDate = new Date(transactionYear, transactionMonth, 1);
    const key = `${transactionYear}-${String(transactionMonth + 1).padStart(2, "0")}`;
    const point = monthlyData.get(key) ?? {
      date: monthDate,
      name: format(monthDate, "MMM"),
      income: 0,
      expense: 0,
    };
    if (transaction.type === "income") {
      point.income += amount;
    } else if (transaction.type === "expense") {
      point.expense += amount;
    }
    monthlyData.set(key, point);
  }

  return {
    totalIncome,
    totalExpenses,
    currentBalance:
      startingBalanceForYear +
      totalIncome -
      totalExpenses +
      transferNet,
    overviewData: [...monthlyData.values()]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(({ name, income, expense }) => ({ name, income, expense })),
    currentMonthIncome,
    currentMonthExpenses,
    previousMonthIncome,
    previousMonthExpenses,
    savingsRate:
      totalIncome > 0
        ? ((totalIncome - totalExpenses) / totalIncome) * 100
        : 0,
  };
}
