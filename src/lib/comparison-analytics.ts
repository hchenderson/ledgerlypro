import { endOfMonth, getDaysInMonth, getMonth } from "date-fns";

import { findMainCategoryForTransaction } from "@/lib/category-tree";
import {
  filterTransactionsByDateRange,
  parseTransactionDate,
  summarizeTransactions,
  transactionAmount,
  type FinancialDateRange,
} from "@/lib/financial-summary";
import type { Category, Transaction } from "@/types";

export type ComparisonRangePreset =
  | "ytd"
  | "full"
  | "h1"
  | "h2"
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | "custom";

export interface ComparisonDateRanges {
  primary: FinancialDateRange;
  comparison: FinancialDateRange;
}

export interface ComparisonSnapshot {
  year: number;
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  transactionCount: number;
  averageTransaction: number;
  averageMonthlyNet: number;
  largestExpense: Transaction | null;
}

export interface ComparisonDelta {
  value: number;
  percent: number | null;
}

export interface MonthlyComparisonPoint {
  month: string;
  monthIndex: number;
  primaryIncome: number;
  comparisonIncome: number;
  primaryExpenses: number;
  comparisonExpenses: number;
  primaryNet: number;
  comparisonNet: number;
  primaryCumulativeIncome: number;
  comparisonCumulativeIncome: number;
  primaryCumulativeExpenses: number;
  comparisonCumulativeExpenses: number;
  primaryCumulativeNet: number;
  comparisonCumulativeNet: number;
}

export interface CategoryComparison {
  category: string;
  primary: number;
  comparison: number;
  delta: number;
  percentChange: number | null;
  primaryShare: number;
  comparisonShare: number;
}

export interface YearComparisonAnalytics {
  primary: ComparisonSnapshot;
  comparison: ComparisonSnapshot;
  deltas: {
    income: ComparisonDelta;
    expenses: ComparisonDelta;
    net: ComparisonDelta;
    savingsRate: ComparisonDelta;
    transactionCount: ComparisonDelta;
  };
  monthly: MonthlyComparisonPoint[];
  expenseCategories: CategoryComparison[];
  incomeCategories: CategoryComparison[];
  monthsWon: number;
  monthsCompared: number;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const clampMonth = (month: number) => Math.max(0, Math.min(11, month));

const rangeForMonths = (
  year: number,
  requestedStartMonth: number,
  requestedEndMonth: number
): FinancialDateRange => {
  const startMonth = clampMonth(
    Math.min(requestedStartMonth, requestedEndMonth)
  );
  const endMonth = clampMonth(
    Math.max(requestedStartMonth, requestedEndMonth)
  );
  return {
    from: new Date(year, startMonth, 1),
    to: endOfMonth(new Date(year, endMonth, 1)),
  };
};

const matchingDate = (year: number, source: Date) => {
  const month = getMonth(source);
  const maximumDay = getDaysInMonth(new Date(year, month, 1));
  return new Date(year, month, Math.min(source.getDate(), maximumDay));
};

export function buildComparisonDateRanges({
  preset,
  primaryYear,
  comparisonYear,
  now = new Date(),
  startMonth = 0,
  endMonth = 11,
}: {
  preset: ComparisonRangePreset;
  primaryYear: number;
  comparisonYear: number;
  now?: Date;
  startMonth?: number;
  endMonth?: number;
}): ComparisonDateRanges {
  if (preset === "ytd") {
    return {
      primary: {
        from: new Date(primaryYear, 0, 1),
        to: matchingDate(primaryYear, now),
      },
      comparison: {
        from: new Date(comparisonYear, 0, 1),
        to: matchingDate(comparisonYear, now),
      },
    };
  }

  let rangeStartMonth = 0;
  let rangeEndMonth = 11;
  if (preset === "h1") {
    rangeStartMonth = 0;
    rangeEndMonth = 5;
  } else if (preset === "h2") {
    rangeStartMonth = 6;
    rangeEndMonth = 11;
  } else if (preset.startsWith("q")) {
    const quarter = Number(preset.slice(1)) - 1;
    rangeStartMonth = quarter * 3;
    rangeEndMonth = quarter * 3 + 2;
  } else if (preset === "custom") {
    rangeStartMonth = startMonth;
    rangeEndMonth = endMonth;
  }

  return {
    primary: rangeForMonths(primaryYear, rangeStartMonth, rangeEndMonth),
    comparison: rangeForMonths(
      comparisonYear,
      rangeStartMonth,
      rangeEndMonth
    ),
  };
}

const getPercentChange = (current: number, previous: number): number | null => {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const makeDelta = (current: number, previous: number): ComparisonDelta => ({
  value: current - previous,
  percent: getPercentChange(current, previous),
});

const transactionDateParts = (transaction: Transaction) => {
  const date = parseTransactionDate(transaction.date);
  if (!date) return null;
  return { month: getMonth(date) };
};

const computeSnapshot = (
  transactions: Transaction[],
  year: number,
  monthCount: number
): ComparisonSnapshot => {
  let largestExpense: Transaction | null = null;

  for (const transaction of transactions) {
    const amount = transactionAmount(transaction);
    if (transaction.type === "expense") {
      if (!largestExpense || amount > transactionAmount(largestExpense)) {
        largestExpense = transaction;
      }
    }
  }

  const { income, expenses, net, transactionCount } =
    summarizeTransactions(transactions);
  const totalVolume = income + expenses;

  return {
    year,
    income,
    expenses,
    net,
    savingsRate: income > 0 ? (net / income) * 100 : 0,
    transactionCount,
    averageTransaction:
      transactionCount > 0 ? totalVolume / transactionCount : 0,
    averageMonthlyNet: monthCount > 0 ? net / monthCount : 0,
    largestExpense,
  };
};

const computeCategoryComparison = (
  primaryTransactions: Transaction[],
  comparisonTransactions: Transaction[],
  type: Transaction["type"],
  categories: Category[]
): CategoryComparison[] => {
  const primaryMap = new Map<string, number>();
  const comparisonMap = new Map<string, number>();
  const categoryFor = (transaction: Transaction) =>
    categories.length > 0
      ? findMainCategoryForTransaction(transaction, categories)
      : transaction.category?.trim() || "Uncategorized";

  for (const transaction of primaryTransactions) {
    if (transaction.type !== type) continue;
    const category = categoryFor(transaction);
    primaryMap.set(
      category,
      (primaryMap.get(category) ?? 0) + transactionAmount(transaction)
    );
  }

  for (const transaction of comparisonTransactions) {
    if (transaction.type !== type) continue;
    const category = categoryFor(transaction);
    comparisonMap.set(
      category,
      (comparisonMap.get(category) ?? 0) + transactionAmount(transaction)
    );
  }

  const totalPrimary = [...primaryMap.values()].reduce((sum, value) => sum + value, 0);
  const totalComparison = [...comparisonMap.values()].reduce(
    (sum, value) => sum + value,
    0
  );

  return [...new Set([...primaryMap.keys(), ...comparisonMap.keys()])]
    .map((category) => {
      const primary = primaryMap.get(category) ?? 0;
      const comparison = comparisonMap.get(category) ?? 0;
      return {
        category,
        primary,
        comparison,
        delta: primary - comparison,
        percentChange: getPercentChange(primary, comparison),
        primaryShare: totalPrimary > 0 ? (primary / totalPrimary) * 100 : 0,
        comparisonShare:
          totalComparison > 0 ? (comparison / totalComparison) * 100 : 0,
      };
    })
    .sort(
      (a, b) =>
        Math.max(b.primary, b.comparison) - Math.max(a.primary, a.comparison)
    );
};

export function computeYearComparison(
  transactions: Transaction[],
  primaryYear: number,
  comparisonYear: number,
  ranges: ComparisonDateRanges,
  categories: Category[] = []
): YearComparisonAnalytics {
  const startMonth = getMonth(ranges.primary.from);
  const endMonth = getMonth(ranges.primary.to);
  const monthCount = endMonth - startMonth + 1;

  const primaryTransactions = filterTransactionsByDateRange(
    transactions,
    ranges.primary
  );
  const comparisonTransactions = filterTransactionsByDateRange(
    transactions,
    ranges.comparison
  );

  const primary = computeSnapshot(primaryTransactions, primaryYear, monthCount);
  const comparison = computeSnapshot(
    comparisonTransactions,
    comparisonYear,
    monthCount
  );

  const monthly = Array.from({ length: monthCount }, (_, index) => {
    const monthIndex = startMonth + index;
    const aggregate = (yearTransactions: Transaction[]) => {
      let income = 0;
      let expenses = 0;
      for (const transaction of yearTransactions) {
        if (transactionDateParts(transaction)?.month !== monthIndex) continue;
        const amount = transactionAmount(transaction);
        if (transaction.type === "income") income += amount;
        else if (transaction.type === "expense") expenses += amount;
      }
      return { income, expenses, net: income - expenses };
    };

    const primaryMonth = aggregate(primaryTransactions);
    const comparisonMonth = aggregate(comparisonTransactions);

    return {
      month: MONTH_NAMES[monthIndex],
      monthIndex,
      primaryIncome: primaryMonth.income,
      comparisonIncome: comparisonMonth.income,
      primaryExpenses: primaryMonth.expenses,
      comparisonExpenses: comparisonMonth.expenses,
      primaryNet: primaryMonth.net,
      comparisonNet: comparisonMonth.net,
      primaryCumulativeIncome: 0,
      comparisonCumulativeIncome: 0,
      primaryCumulativeExpenses: 0,
      comparisonCumulativeExpenses: 0,
      primaryCumulativeNet: 0,
      comparisonCumulativeNet: 0,
    };
  });

  let primaryCumulativeNet = 0;
  let comparisonCumulativeNet = 0;
  let primaryCumulativeIncome = 0;
  let comparisonCumulativeIncome = 0;
  let primaryCumulativeExpenses = 0;
  let comparisonCumulativeExpenses = 0;
  for (const point of monthly) {
    primaryCumulativeIncome += point.primaryIncome;
    comparisonCumulativeIncome += point.comparisonIncome;
    primaryCumulativeExpenses += point.primaryExpenses;
    comparisonCumulativeExpenses += point.comparisonExpenses;
    primaryCumulativeNet += point.primaryNet;
    comparisonCumulativeNet += point.comparisonNet;
    point.primaryCumulativeIncome = primaryCumulativeIncome;
    point.comparisonCumulativeIncome = comparisonCumulativeIncome;
    point.primaryCumulativeExpenses = primaryCumulativeExpenses;
    point.comparisonCumulativeExpenses = comparisonCumulativeExpenses;
    point.primaryCumulativeNet = primaryCumulativeNet;
    point.comparisonCumulativeNet = comparisonCumulativeNet;
  }

  return {
    primary,
    comparison,
    deltas: {
      income: makeDelta(primary.income, comparison.income),
      expenses: makeDelta(primary.expenses, comparison.expenses),
      net: makeDelta(primary.net, comparison.net),
      savingsRate: makeDelta(primary.savingsRate, comparison.savingsRate),
      transactionCount: makeDelta(
        primary.transactionCount,
        comparison.transactionCount
      ),
    },
    monthly,
    expenseCategories: computeCategoryComparison(
      primaryTransactions,
      comparisonTransactions,
      "expense",
      categories
    ),
    incomeCategories: computeCategoryComparison(
      primaryTransactions,
      comparisonTransactions,
      "income",
      categories
    ),
    monthsWon: monthly.filter(
      (point) => point.primaryNet > point.comparisonNet
    ).length,
    monthsCompared: monthly.length,
  };
}
