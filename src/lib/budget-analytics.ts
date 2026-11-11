import { getYear } from "date-fns";

import {
  findCategoryByIdRecursive,
  findCategoryWithPathById,
  getCategorySubtreeIdsAndNames,
  normalizeCategoryName,
} from "@/lib/category-tree";
import {
  financialReportingTransactions,
  financialTransactionAmount,
} from "@/lib/financial-summary";
import type { Budget, Category, Transaction } from "@/types";
import { minorToMajor, moneyMinor } from "@/lib/money";
import { ledgerDateToDate, transactionLedgerDate } from "@/lib/ledger-date";

export interface BudgetDetails extends Budget {
  categoryName: string;
  spent: number;
  remaining: number;
  progress: number;
  deltas: {
    amount: number;
    spent: number;
    remaining: number;
  } | null;
}

export interface GetBudgetDetailsParams {
  activeBudgets: Budget[];
  comparisonBudgets?: Budget[];
  /** Transactions already scoped to the accounts selected by the caller. */
  transactions: Transaction[];
  categories: Category[];
  forDate: Date;
  comparisonYear?: number;
}

/**
 * Computes the per-budget cards used by Budgets and Dashboard.
 *
 * A parent budget intentionally includes its whole category subtree. When a
 * parent and child budget both exist, their individual cards overlap; callers
 * must not sum those card values. The Reports aggregate instead assigns each
 * expense to the most-specific matching budget so its total can reconcile to
 * report expenses without double counting.
 */
export function calculateBudgetDetails(
  {
    activeBudgets,
    comparisonBudgets = [],
    transactions,
    categories,
    forDate,
    comparisonYear,
  }: GetBudgetDetailsParams,
  firstYear: number,
): BudgetDetails[] {
  const reportYear = getYear(forDate);
  const reportingTransactions = financialReportingTransactions(transactions);

  const findFirstTransactionYearForBudget = (
    allTransactions: Transaction[],
    categoryIds: string[],
    categoryNames: string[],
  ) => {
    const budgetTransactions = allTransactions
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          (transaction.categoryId
            ? categoryIds.includes(transaction.categoryId)
            : categoryNames.includes(transaction.category)),
      )
      .sort(
        (first, second) =>
          transactionLedgerDate(first).localeCompare(transactionLedgerDate(second)),
      );

    return budgetTransactions.length > 0
      ? getYear(new Date(budgetTransactions[0].date))
      : null;
  };

  const relevantBudgets = activeBudgets.filter((budget) => {
    let effectiveYear = budget.year;
    if (typeof effectiveYear !== "number") {
      const category = findCategoryByIdRecursive(
        budget.categoryId,
        categories,
      );
      const subtree = category
        ? getCategorySubtreeIdsAndNames(category)
        : { ids: [], names: [] };
      effectiveYear =
        findFirstTransactionYearForBudget(
          reportingTransactions,
          subtree.ids,
          subtree.names,
        ) ?? firstYear;
    }
    return effectiveYear === reportYear;
  });

  const calculateSpending = (
    budget: Budget,
    categoryIds: string[],
    categoryNames: string[],
    currentDate: Date,
    year: number,
  ) =>
    reportingTransactions
      .filter((transaction) => {
        const transactionDate = ledgerDateToDate(transactionLedgerDate(transaction));
        if (getYear(transactionDate) !== year) return false;
        if (transaction.type !== "expense") return false;

        const categoryMatches = transaction.categoryId
          ? categoryIds.includes(transaction.categoryId)
          : categoryNames.includes(
              normalizeCategoryName(transaction.category),
            );
        if (!categoryMatches) return false;

        if (budget.period === "monthly") {
          return transactionDate.getMonth() === currentDate.getMonth();
        }
        return budget.period === "yearly";
      })
      .reduce(
        (sum, transaction) => sum + financialTransactionAmount(transaction),
        0,
      );

  return relevantBudgets.map((budget) => {
    const budgetAmount = minorToMajor(moneyMinor(budget));
    const categoryResult = findCategoryWithPathById(
      budget.categoryId,
      categories,
    );
    const categoryName = categoryResult
      ? categoryResult.path.map((category) => category.name).join(" > ")
      : "Unknown Category";
    const subtree = categoryResult
      ? getCategorySubtreeIdsAndNames(categoryResult.category)
      : { ids: [], names: [] };
    const spent = calculateSpending(
      budget,
      subtree.ids,
      subtree.names,
      forDate,
      reportYear,
    );
    const remaining = budgetAmount - spent;
    const progress = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

    let deltas: BudgetDetails["deltas"] = null;
    if (comparisonYear && comparisonBudgets.length > 0) {
      const comparisonBudget = comparisonBudgets.find(
        (candidate) =>
          candidate.categoryId === budget.categoryId &&
          candidate.period === budget.period,
      );
      if (comparisonBudget) {
        const comparisonDate = new Date(
          comparisonYear,
          forDate.getMonth(),
          1,
        );
        const comparisonSpent = calculateSpending(
          comparisonBudget,
          subtree.ids,
          subtree.names,
          comparisonDate,
          comparisonYear,
        );
        deltas = {
          amount: budgetAmount - minorToMajor(moneyMinor(comparisonBudget)),
          spent: spent - comparisonSpent,
          remaining:
            remaining - (minorToMajor(moneyMinor(comparisonBudget)) - comparisonSpent),
        };
      }
    }

    return {
      ...budget,
      amount: budgetAmount,
      categoryName,
      spent,
      remaining,
      progress,
      deltas,
    };
  });
}
