import { endOfYear, format, getMonth, startOfYear } from "date-fns";

import { transferBalanceDelta } from "@/lib/accounts";
import { buildFinancialCategoryBreakdown } from "@/lib/financial-category-breakdown";
import { financialTransactionAmount, parseTransactionDate } from "@/lib/financial-summary";
import { filterReportTransactions } from "@/lib/report-analytics";
import type { Category, Transaction } from "@/types";

export interface EOYMonthlyPoint {
  monthIndex: number;
  label: string;
  income: number;
  expenses: number;
  net: number;
  transferNet: number;
  balanceChange: number;
}

export interface EOYCategorySummary {
  key: string;
  categoryId: string | null;
  name: string;
  total: number;
  percentageOfTotal: number;
  status: "resolved" | "uncategorized" | "unresolved";
}

export interface EOYReportData {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  net: number;
  monthly: EOYMonthlyPoint[];
  categories: EOYCategorySummary[];
  mainCategories: EOYCategorySummary[];
  calculationVersion: 5;
  scopeLabel: string;
}

export function computeEOYReport(
  allTransactions: Transaction[],
  categories: Category[],
  year: number,
): EOYReportData {
  const range = {
    from: startOfYear(new Date(year, 0, 1)),
    to: endOfYear(new Date(year, 11, 31)),
  };
  const yearTransactions = filterReportTransactions(
    allTransactions,
    range,
    {
      accountIds: [],
      transactionTypes: ["income", "expense"],
      includedCategoryKeys: [],
      excludedCategoryKeys: [],
      includePending: false,
      includeTransfers: true,
    },
    categories,
  );
  const monthly: EOYMonthlyPoint[] = Array.from({ length: 12 }, (_, index) => ({
    monthIndex: index,
    label: format(new Date(year, index, 1), "MMM"),
    income: 0,
    expenses: 0,
    net: 0,
    transferNet: 0,
    balanceChange: 0,
  }));

  for (const transaction of yearTransactions) {
    const date = parseTransactionDate(transaction.date);
    if (!date) continue;
    const point = monthly[getMonth(date)];
    const amount = financialTransactionAmount(transaction);
    if (transaction.type === "income") point.income += amount;
    else if (transaction.type === "expense") point.expenses += amount;
    else if (transaction.type === "transfer") {
      point.transferNet += transferBalanceDelta(transaction);
    }
  }
  for (const point of monthly) {
    point.net = point.income - point.expenses;
    point.balanceChange = point.net + point.transferNet;
  }
  const totalIncome = monthly.reduce((sum, point) => sum + point.income, 0);
  const totalExpenses = monthly.reduce((sum, point) => sum + point.expenses, 0);
  const financialTransactions = yearTransactions.filter(
    (transaction) => transaction.type === "income" || transaction.type === "expense",
  );
  const toSummary = (
    row: ReturnType<typeof buildFinancialCategoryBreakdown>[number],
  ): EOYCategorySummary => ({
    key: row.key,
    categoryId: row.categoryId,
    name: row.label,
    total: row.amount,
    percentageOfTotal: row.share,
    status: row.status,
  });

  return {
    year,
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
    monthly,
    categories: buildFinancialCategoryBreakdown(
      financialTransactions,
      "expense",
      categories,
      "category",
    ).map(toSummary),
    mainCategories: buildFinancialCategoryBreakdown(
      financialTransactions,
      "expense",
      categories,
      "root",
    ).map(toSummary),
    calculationVersion: 5,
    scopeLabel: "Caller-selected accounts · finalized activity · transfers excluded from income and expense",
  };
}
