import { getMonth, getYear, parseISO } from "date-fns";

import type { Transaction } from "@/types";

export interface ComparisonRange {
  startMonth: number;
  endMonth: number;
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

const getPercentChange = (current: number, previous: number): number | null => {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const makeDelta = (current: number, previous: number): ComparisonDelta => ({
  value: current - previous,
  percent: getPercentChange(current, previous),
});

const normalizeAmount = (amount: number) =>
  Number.isFinite(amount) ? Math.abs(amount) : 0;

const transactionDateParts = (transaction: Transaction) => {
  const date = parseISO(transaction.date);
  if (Number.isNaN(date.getTime())) return null;
  return { year: getYear(date), month: getMonth(date) };
};

const transactionsForPeriod = (
  transactions: Transaction[],
  year: number,
  range: ComparisonRange
) =>
  transactions.filter((transaction) => {
    const parts = transactionDateParts(transaction);
    return (
      parts?.year === year &&
      parts.month >= range.startMonth &&
      parts.month <= range.endMonth
    );
  });

const computeSnapshot = (
  transactions: Transaction[],
  year: number,
  monthCount: number
): ComparisonSnapshot => {
  let income = 0;
  let expenses = 0;
  let largestExpense: Transaction | null = null;

  for (const transaction of transactions) {
    const amount = normalizeAmount(transaction.amount);
    if (transaction.type === "income") {
      income += amount;
    } else {
      expenses += amount;
      if (!largestExpense || amount > normalizeAmount(largestExpense.amount)) {
        largestExpense = transaction;
      }
    }
  }

  const net = income - expenses;
  const totalVolume = income + expenses;

  return {
    year,
    income,
    expenses,
    net,
    savingsRate: income > 0 ? (net / income) * 100 : 0,
    transactionCount: transactions.length,
    averageTransaction:
      transactions.length > 0 ? totalVolume / transactions.length : 0,
    averageMonthlyNet: monthCount > 0 ? net / monthCount : 0,
    largestExpense,
  };
};

const computeCategoryComparison = (
  primaryTransactions: Transaction[],
  comparisonTransactions: Transaction[],
  type: Transaction["type"]
): CategoryComparison[] => {
  const primaryMap = new Map<string, number>();
  const comparisonMap = new Map<string, number>();

  for (const transaction of primaryTransactions) {
    if (transaction.type !== type) continue;
    const category = transaction.category?.trim() || "Uncategorized";
    primaryMap.set(
      category,
      (primaryMap.get(category) ?? 0) + normalizeAmount(transaction.amount)
    );
  }

  for (const transaction of comparisonTransactions) {
    if (transaction.type !== type) continue;
    const category = transaction.category?.trim() || "Uncategorized";
    comparisonMap.set(
      category,
      (comparisonMap.get(category) ?? 0) + normalizeAmount(transaction.amount)
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
  requestedRange: ComparisonRange
): YearComparisonAnalytics {
  const startMonth = clampMonth(
    Math.min(requestedRange.startMonth, requestedRange.endMonth)
  );
  const endMonth = clampMonth(
    Math.max(requestedRange.startMonth, requestedRange.endMonth)
  );
  const range = { startMonth, endMonth };
  const monthCount = endMonth - startMonth + 1;

  const primaryTransactions = transactionsForPeriod(
    transactions,
    primaryYear,
    range
  );
  const comparisonTransactions = transactionsForPeriod(
    transactions,
    comparisonYear,
    range
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
        const amount = normalizeAmount(transaction.amount);
        if (transaction.type === "income") income += amount;
        else expenses += amount;
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
      "expense"
    ),
    incomeCategories: computeCategoryComparison(
      primaryTransactions,
      comparisonTransactions,
      "income"
    ),
    monthsWon: monthly.filter(
      (point) => point.primaryNet > point.comparisonNet
    ).length,
    monthsCompared: monthly.length,
  };
}
