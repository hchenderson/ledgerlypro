import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  getDaysInMonth,
  getDaysInYear,
  isAfter,
  max,
  min,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";

import {
  calculateAccountBalanceAsOf,
  calculateAccountBalanceBefore,
  transactionBalanceDelta,
} from "@/lib/accounts";
import {
  findCategoryWithPathById,
  getCategorySubtreeIdsAndNames,
  normalizeCategoryName,
} from "@/lib/category-tree";
import {
  financialCategoryKey,
  financialCategoryLabel,
} from "@/lib/financial-category";
import {
  parseTransactionDate,
  transactionAmount,
  type FinancialDateRange,
} from "@/lib/financial-summary";
import type { Account, Budget, Category, Transaction } from "@/types";
import {
  expandTransactionsForReporting,
  sourceTransactionId,
} from "@/lib/transaction-allocations";

export type ReportComparisonMode =
  | "none"
  | "previous-period"
  | "previous-month"
  | "previous-quarter"
  | "previous-year"
  | "custom";

export type ReportGranularity = "day" | "week" | "month" | "quarter";

export type ReportSectionId =
  | "summary"
  | "cash-flow"
  | "category-breakdown"
  | "category-movement"
  | "insights"
  | "budgets"
  | "balances"
  | "transfers"
  | "goals"
  | "envelopes"
  | "transactions";

export type ReportMetricId =
  | "income"
  | "expenses"
  | "net"
  | "savings-rate"
  | "transaction-count"
  | "average-transaction"
  | "average-monthly-net"
  | "largest-expense"
  | "largest-income"
  | "ending-balance"
  | "budget-variance";

export const DEFAULT_REPORT_SECTIONS: ReportSectionId[] = [
  "summary",
  "cash-flow",
  "insights",
  "category-breakdown",
  "category-movement",
  "budgets",
  "balances",
  "transfers",
  "goals",
  "envelopes",
  "transactions",
];

export const DEFAULT_REPORT_METRICS: ReportMetricId[] = [
  "income",
  "expenses",
  "net",
  "savings-rate",
  "transaction-count",
  "average-transaction",
  "average-monthly-net",
  "ending-balance",
];

export interface ReportFilterConfiguration {
  accountIds: string[];
  transactionTypes: ("income" | "expense")[];
  includedCategoryKeys: string[];
  excludedCategoryKeys: string[];
  includePending: boolean;
  includeTransfers: boolean;
}

export interface ReportPeriodPoint {
  key: string;
  name: string;
  income: number;
  expense: number;
  net: number;
}

export interface ReportCategoryTotal {
  category: string;
  amount: number;
  share: number;
}

export interface ReportCategoryMovement {
  category: string;
  current: number;
  comparison: number;
  change: number;
  percentChange: number | null;
}

export interface ReportSummary {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  transactionCount: number;
  averageTransaction: number;
  averageMonthlyNet: number;
  largestExpense: Transaction | null;
  largestIncome: Transaction | null;
}

export interface ReportAccountBalanceRow {
  accountId: string;
  accountName: string;
  startingBalance: number;
  endingBalance: number;
  change: number;
}

export interface ReportBalanceSummary {
  startingBalance: number;
  endingBalance: number;
  change: number;
  lowestBalance: number;
  highestBalance: number;
  averageDailyBalance: number;
  accounts: ReportAccountBalanceRow[];
  daily: { date: string; balance: number }[];
}

export interface ReportTransferAccountRow {
  accountId: string;
  accountName: string;
  transfersIn: number;
  transfersOut: number;
  net: number;
}

export interface ReportTransferSummary {
  transfersIn: number;
  transfersOut: number;
  totalMoved: number;
  net: number;
  count: number;
  byAccount: ReportTransferAccountRow[];
}

export interface ReportBudgetRow {
  budgetId: string;
  categoryName: string;
  budget: number;
  actual: number;
  remaining: number;
  percentUsed: number;
  projected: number;
}

export interface ReportBudgetSummary {
  budget: number;
  actual: number;
  remaining: number;
  percentUsed: number;
  rows: ReportBudgetRow[];
}

export interface ReportAnalytics {
  transactions: Transaction[];
  financialTransactions: Transaction[];
  summary: ReportSummary;
  periods: ReportPeriodPoint[];
  incomeCategories: ReportCategoryTotal[];
  expenseCategories: ReportCategoryTotal[];
  transfers: ReportTransferSummary;
}

function isIncludedPostingStatus(
  transaction: Transaction,
  includePending: boolean,
) {
  if (transaction.providerRemovedAt || transaction.postingStatus === "removed") {
    return false;
  }
  return includePending || transaction.postingStatus !== "pending";
}

function dateWithinRange(date: Date, range: FinancialDateRange) {
  return (
    date.getTime() >= startOfDay(range.from).getTime() &&
    date.getTime() <= endOfDay(range.to).getTime()
  );
}

export function filterReportTransactions(
  transactions: Transaction[],
  range: FinancialDateRange,
  filters: ReportFilterConfiguration,
  categories: Category[],
  defaultAccountId?: string | null,
): Transaction[] {
  const accounts = new Set(filters.accountIds);
  const included = new Set(filters.includedCategoryKeys);
  const excluded = new Set(filters.excludedCategoryKeys);

  return expandTransactionsForReporting(transactions).filter((transaction) => {
    const date = parseTransactionDate(transaction.date);
    if (!date || !dateWithinRange(date, range)) return false;
    if (!isIncludedPostingStatus(transaction, filters.includePending)) {
      return false;
    }
    if (transaction.possibleTransfer) return false;
    const accountId = transaction.accountId ?? defaultAccountId ?? "";
    if (accounts.size > 0 && !accounts.has(accountId)) return false;
    if (transaction.type === "transfer") return filters.includeTransfers;
    if (!filters.transactionTypes.includes(transaction.type)) return false;

    const categoryKey = financialCategoryKey(transaction, categories);
    if (categoryKey && excluded.has(categoryKey)) return false;
    if (included.size > 0 && (!categoryKey || !included.has(categoryKey))) {
      return false;
    }
    return true;
  });
}

function periodBoundary(date: Date, granularity: ReportGranularity) {
  if (granularity === "day") return startOfDay(date);
  if (granularity === "week") return startOfWeek(date, { weekStartsOn: 1 });
  if (granularity === "quarter") return startOfQuarter(date);
  return startOfMonth(date);
}

function periodLabel(date: Date, granularity: ReportGranularity) {
  if (granularity === "day") return format(date, "MMM d");
  if (granularity === "week") return `Week of ${format(date, "MMM d")}`;
  if (granularity === "quarter") return `Q${Math.floor(date.getMonth() / 3) + 1} ${format(date, "yy")}`;
  return format(date, "MMM yy");
}

function categoryTotals(
  transactions: Transaction[],
  type: "income" | "expense",
  categories: Category[],
): ReportCategoryTotal[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== type) continue;
    const category = financialCategoryLabel(transaction, categories);
    totals.set(category, (totals.get(category) ?? 0) + transactionAmount(transaction));
  }
  const overall = [...totals.values()].reduce((sum, amount) => sum + amount, 0);
  return [...totals.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      share: overall > 0 ? (amount / overall) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function summarizeReportTransactions(
  financialTransactions: Transaction[],
  range: FinancialDateRange,
): ReportSummary {
  let income = 0;
  let expenses = 0;
  let largestExpense: Transaction | null = null;
  let largestIncome: Transaction | null = null;
  for (const transaction of financialTransactions) {
    const amount = transactionAmount(transaction);
    if (transaction.type === "income") {
      income += amount;
      if (!largestIncome || amount > transactionAmount(largestIncome)) {
        largestIncome = transaction;
      }
    } else if (transaction.type === "expense") {
      expenses += amount;
      if (!largestExpense || amount > transactionAmount(largestExpense)) {
        largestExpense = transaction;
      }
    }
  }
  const transactionCount = new Set(
    financialTransactions.map(sourceTransactionId),
  ).size;
  const net = income - expenses;
  const monthCount = Math.max(
    1,
    (range.to.getFullYear() - range.from.getFullYear()) * 12 +
      range.to.getMonth() -
      range.from.getMonth() +
      1,
  );
  return {
    income,
    expenses,
    net,
    savingsRate: income > 0 ? (net / income) * 100 : 0,
    transactionCount,
    averageTransaction:
      transactionCount > 0 ? (income + expenses) / transactionCount : 0,
    averageMonthlyNet: net / monthCount,
    largestExpense,
    largestIncome,
  };
}

export function computeReportAnalytics(
  transactions: Transaction[],
  range: FinancialDateRange,
  filters: ReportFilterConfiguration,
  categories: Category[],
  accounts: Account[],
  granularity: ReportGranularity,
  defaultAccountId?: string | null,
): ReportAnalytics {
  const filtered = filterReportTransactions(
    transactions,
    range,
    filters,
    categories,
    defaultAccountId,
  );
  const financialTransactions = filtered.filter(
    (transaction) =>
      transaction.type === "income" || transaction.type === "expense",
  );
  const periodMap = new Map<string, ReportPeriodPoint>();
  for (const transaction of financialTransactions) {
    const date = parseTransactionDate(transaction.date);
    if (!date) continue;
    const boundary = periodBoundary(date, granularity);
    const key = boundary.toISOString();
    const point = periodMap.get(key) ?? {
      key,
      name: periodLabel(boundary, granularity),
      income: 0,
      expense: 0,
      net: 0,
    };
    const amount = transactionAmount(transaction);
    if (transaction.type === "income") point.income += amount;
    else point.expense += amount;
    point.net = point.income - point.expense;
    periodMap.set(key, point);
  }

  const transferRows = new Map<string, ReportTransferAccountRow>();
  let transfersIn = 0;
  let transfersOut = 0;
  const transferGroups = new Map<string, number>();
  for (const transaction of filtered) {
    if (transaction.type !== "transfer") continue;
    const amount = transactionAmount(transaction);
    const accountId = transaction.accountId ?? defaultAccountId ?? "";
    const accountName =
      accounts.find((account) => account.id === accountId)?.name ??
      "Primary Account";
    const row = transferRows.get(accountId) ?? {
      accountId,
      accountName,
      transfersIn: 0,
      transfersOut: 0,
      net: 0,
    };
    if (transaction.transferDirection === "in") {
      transfersIn += amount;
      row.transfersIn += amount;
    } else {
      transfersOut += amount;
      row.transfersOut += amount;
    }
    row.net = row.transfersIn - row.transfersOut;
    transferRows.set(accountId, row);
    const transferKey = transaction.transferId ?? transaction.id;
    transferGroups.set(
      transferKey,
      Math.max(transferGroups.get(transferKey) ?? 0, amount),
    );
  }

  return {
    transactions: filtered,
    financialTransactions,
    summary: summarizeReportTransactions(financialTransactions, range),
    periods: [...periodMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
    incomeCategories: categoryTotals(financialTransactions, "income", categories),
    expenseCategories: categoryTotals(financialTransactions, "expense", categories),
    transfers: {
      transfersIn,
      transfersOut,
      totalMoved: [...transferGroups.values()].reduce(
        (sum, amount) => sum + amount,
        0,
      ),
      net: transfersIn - transfersOut,
      count: transferGroups.size,
      byAccount: [...transferRows.values()].sort(
        (a, b) => b.transfersIn + b.transfersOut - a.transfersIn - a.transfersOut,
      ),
    },
  };
}

export function buildReportComparisonRange(
  primary: FinancialDateRange,
  mode: ReportComparisonMode,
  custom?: FinancialDateRange,
): FinancialDateRange | null {
  if (mode === "none") return null;
  if (mode === "custom") return custom ?? null;
  if (mode === "previous-month") {
    const date = subMonths(primary.from, 1);
    return { from: startOfMonth(date), to: endOfMonth(date) };
  }
  if (mode === "previous-quarter") {
    const date = subQuarters(primary.from, 1);
    return { from: startOfQuarter(date), to: endOfQuarter(date) };
  }
  if (mode === "previous-year") {
    return { from: subYears(primary.from, 1), to: subYears(primary.to, 1) };
  }
  const days = differenceInCalendarDays(primary.to, primary.from) + 1;
  const to = subDays(startOfDay(primary.from), 1);
  return { from: subDays(to, days - 1), to: endOfDay(to) };
}

function percentChange(current: number, comparison: number): number | null {
  if (comparison === 0) return current === 0 ? 0 : null;
  return ((current - comparison) / Math.abs(comparison)) * 100;
}

export function computeCategoryMovement(
  current: ReportCategoryTotal[],
  comparison: ReportCategoryTotal[],
): ReportCategoryMovement[] {
  const currentMap = new Map(current.map((item) => [item.category, item.amount]));
  const comparisonMap = new Map(
    comparison.map((item) => [item.category, item.amount]),
  );
  return [...new Set([...currentMap.keys(), ...comparisonMap.keys()])]
    .map((category) => {
      const currentAmount = currentMap.get(category) ?? 0;
      const comparisonAmount = comparisonMap.get(category) ?? 0;
      return {
        category,
        current: currentAmount,
        comparison: comparisonAmount,
        change: currentAmount - comparisonAmount,
        percentChange: percentChange(currentAmount, comparisonAmount),
      };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

export function computeReportBalances(
  allTransactions: Transaction[],
  accounts: Account[],
  range: FinancialDateRange,
  selectedAccountIds: string[],
): ReportBalanceSummary {
  const selected =
    selectedAccountIds.length > 0
      ? accounts.filter((account) => selectedAccountIds.includes(account.id))
      : accounts;
  const startingBalance = selected.reduce(
    (sum, account) =>
      sum + calculateAccountBalanceBefore(account, allTransactions, startOfDay(range.from)),
    0,
  );
  const endingBalance = selected.reduce(
    (sum, account) => sum + calculateAccountBalanceAsOf(account, allTransactions, range.to),
    0,
  );
  const accountsSummary = selected.map((account) => {
    const start = calculateAccountBalanceBefore(
      account,
      allTransactions,
      startOfDay(range.from),
    );
    const end = calculateAccountBalanceAsOf(account, allTransactions, range.to);
    return {
      accountId: account.id,
      accountName: account.name,
      startingBalance: start,
      endingBalance: end,
      change: end - start,
    };
  });
  const includedAccountIds = new Set(selected.map((account) => account.id));
  const defaultAccountId = accounts.find((account) => account.isDefault)?.id;
  const deltasByDay = new Map<string, number>();
  for (const transaction of allTransactions) {
    const date = parseTransactionDate(transaction.date);
    if (!date || !dateWithinRange(date, range)) continue;
    const accountId = transaction.accountId ?? defaultAccountId;
    if (!accountId || !includedAccountIds.has(accountId)) continue;
    const key = format(date, "yyyy-MM-dd");
    deltasByDay.set(
      key,
      (deltasByDay.get(key) ?? 0) + transactionBalanceDelta(transaction),
    );
  }
  let running = startingBalance;
  const daily = eachDayOfInterval({
    start: startOfDay(range.from),
    end: startOfDay(range.to),
  }).map((date) => {
    const key = format(date, "yyyy-MM-dd");
    running += deltasByDay.get(key) ?? 0;
    return { date: key, balance: running };
  });
  const values = daily.map((point) => point.balance);
  return {
    startingBalance,
    endingBalance,
    change: endingBalance - startingBalance,
    lowestBalance: values.length ? Math.min(...values) : endingBalance,
    highestBalance: values.length ? Math.max(...values) : endingBalance,
    averageDailyBalance: values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : endingBalance,
    accounts: accountsSummary,
    daily,
  };
}

function overlapRange(
  left: FinancialDateRange,
  right: FinancialDateRange,
): FinancialDateRange | null {
  const from = max([startOfDay(left.from), startOfDay(right.from)]);
  const to = min([endOfDay(left.to), endOfDay(right.to)]);
  return isAfter(from, to) ? null : { from, to };
}

function proratedBudgetAmount(budget: Budget, range: FinancialDateRange) {
  const yearRange = {
    from: startOfYear(new Date(budget.year, 0, 1)),
    to: endOfYear(new Date(budget.year, 0, 1)),
  };
  const overlap = overlapRange(range, yearRange);
  if (!overlap) return 0;
  if (budget.period === "yearly") {
    return (
      budget.amount *
      ((differenceInCalendarDays(overlap.to, overlap.from) + 1) /
        getDaysInYear(overlap.from))
    );
  }
  let amount = 0;
  let cursor = startOfMonth(overlap.from);
  while (!isAfter(cursor, overlap.to)) {
    const monthOverlap = overlapRange(overlap, {
      from: startOfMonth(cursor),
      to: endOfMonth(cursor),
    });
    if (monthOverlap) {
      amount +=
        budget.amount *
        ((differenceInCalendarDays(monthOverlap.to, monthOverlap.from) + 1) /
          getDaysInMonth(cursor));
    }
    cursor = startOfMonth(addDays(endOfMonth(cursor), 1));
  }
  return amount;
}

export function computeReportBudgets(
  budgets: Budget[],
  categories: Category[],
  reportTransactions: Transaction[],
  range: FinancialDateRange,
): ReportBudgetSummary {
  const expenseTransactions = reportTransactions.filter(
    (transaction) => transaction.type === "expense",
  );
  const elapsedDays = Math.max(1, differenceInCalendarDays(min([new Date(), range.to]), range.from) + 1);
  const totalDays = Math.max(1, differenceInCalendarDays(range.to, range.from) + 1);
  const rows = budgets
    .map((budget) => {
      const budgetAmount = proratedBudgetAmount(budget, range);
      if (budgetAmount <= 0) return null;
      const categoryResult = findCategoryWithPathById(
        budget.categoryId,
        categories,
      );
      const subtree = categoryResult
        ? getCategorySubtreeIdsAndNames(categoryResult.category)
        : { ids: [budget.categoryId], names: [] };
      const actual = expenseTransactions
        .filter((transaction) =>
          transaction.categoryId
            ? subtree.ids.includes(transaction.categoryId)
            : subtree.names
                .map((name) => normalizeCategoryName(name).toLocaleLowerCase())
                .includes(normalizeCategoryName(transaction.category).toLocaleLowerCase()),
        )
        .reduce((sum, transaction) => sum + transactionAmount(transaction), 0);
      const categoryName = categoryResult
        ? categoryResult.path.map((category) => category.name).join(" > ")
        : "Unknown category";
      return {
        budgetId: budget.id,
        categoryName,
        budget: budgetAmount,
        actual,
        remaining: budgetAmount - actual,
        percentUsed: budgetAmount > 0 ? (actual / budgetAmount) * 100 : 0,
        projected: elapsedDays < totalDays ? (actual / elapsedDays) * totalDays : actual,
      } satisfies ReportBudgetRow;
    })
    .filter((row): row is ReportBudgetRow => row !== null)
    .sort((a, b) => b.percentUsed - a.percentUsed);
  const budget = rows.reduce((sum, row) => sum + row.budget, 0);
  const actual = rows.reduce((sum, row) => sum + row.actual, 0);
  return {
    budget,
    actual,
    remaining: budget - actual,
    percentUsed: budget > 0 ? (actual / budget) * 100 : 0,
    rows,
  };
}

export function buildReportInsights(
  current: ReportAnalytics,
  comparison: ReportAnalytics | null,
  expenseMovement: ReportCategoryMovement[],
  budgets: ReportBudgetSummary,
): string[] {
  const insights: string[] = [];
  if (comparison) {
    const netChange = current.summary.net - comparison.summary.net;
    insights.push(
      `Net cash flow is ${Math.abs(netChange).toLocaleString("en-US", { style: "currency", currency: "USD" })} ${netChange >= 0 ? "ahead of" : "behind"} the comparison period.`,
    );
    const expenseChange = percentChange(
      current.summary.expenses,
      comparison.summary.expenses,
    );
    if (expenseChange !== null) {
      insights.push(
        `Expenses are ${Math.abs(expenseChange).toFixed(1)}% ${expenseChange <= 0 ? "lower" : "higher"} than the comparison period.`,
      );
    }
    const mover = expenseMovement[0];
    if (mover) {
      insights.push(
        `${mover.category} is the largest spending change at ${Math.abs(mover.change).toLocaleString("en-US", { style: "currency", currency: "USD" })} ${mover.change >= 0 ? "higher" : "lower"}.`,
      );
    }
  }
  if (current.summary.income > 0) {
    insights.push(
      `The savings rate for this period is ${current.summary.savingsRate.toFixed(1)}%.`,
    );
  }
  const overBudget = budgets.rows.filter((row) => row.actual > row.budget);
  if (overBudget.length > 0) {
    insights.push(
      `${overBudget.length} budget categor${overBudget.length === 1 ? "y is" : "ies are"} over the prorated target for this period.`,
    );
  }
  return insights.slice(0, 5);
}
