import type {
  Budget,
  Category,
  Goal,
  RecurringTransaction,
  Transaction,
} from '@/types';
import {
  categorySubtreeIds,
  categorySubtreeNames,
  findCategoryPathById,
  findMainCategoryForTransaction,
  normalizeCategoryLabel,
} from '@/lib/category-tree';
import { financialTransactionAmount } from '@/lib/financial-summary';
import { isFinancialTransaction } from '@/lib/accounts';
import {
  expandTransactionsForReporting,
  sourceTransactionId,
} from '@/lib/transaction-allocations';
import { DEFAULT_REPORTING_TIME_ZONE, ledgerDateToDate, todayLedgerDate, transactionLedgerDate } from '@/lib/ledger-date';

export type FinancialAssistantContext = {
  year: number;
  summary: {
    income: number;
    expenses: number;
    net: number;
    transactionCount: number;
  };
  topExpenseCategories: Array<{ category: string; amount: number }>;
  budgets: Array<{
    category: string;
    amount: number;
    spent: number;
    period: Budget['period'];
  }>;
  goals: Array<{
    name: string;
    targetAmount: number;
    savedAmount: number;
    targetDate?: string;
  }>;
  recurringScheduleCount: number;
  matchingTransactions: Array<{
    date: string;
    description: string;
    amount: number;
    type: "income" | "expense";
    category: string;
  }>;
};

function questionTerms(question: string): string[] {
  return [...new Set(
    question
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((term) => term.length >= 3) ?? []
  )].slice(0, 10);
}

export function buildFinancialAssistantContext({
  transactions,
  categories,
  budgets,
  goals,
  recurringTransactions,
  question,
  year = new Date().getFullYear(),
  reportingTimeZone = DEFAULT_REPORTING_TIME_ZONE,
}: {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: Goal[];
  recurringTransactions: RecurringTransaction[];
  question: string;
  year?: number;
  reportingTimeZone?: string;
}): FinancialAssistantContext {
  const yearlyTransactions = expandTransactionsForReporting(transactions).filter((transaction) => {
    if (!isFinancialTransaction(transaction)) return false;
    return Number(transactionLedgerDate(transaction, reportingTimeZone).slice(0, 4)) === year && transaction.type !== "transfer";
  });
  const income = yearlyTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + financialTransactionAmount(transaction), 0);
  const expenses = yearlyTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + financialTransactionAmount(transaction), 0);

  const categoryTotals = yearlyTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce<Record<string, number>>((totals, transaction) => {
      const category = findMainCategoryForTransaction(transaction, categories);
      totals[category] =
        (totals[category] ?? 0) + financialTransactionAmount(transaction);
      return totals;
    }, {});

  const currentMonth = Number(todayLedgerDate(new Date(), reportingTimeZone).slice(5, 7)) - 1;
  const budgetContext = budgets
    .filter((budget) => budget.year === year)
    .flatMap((budget) => {
      const categoryPath = findCategoryPathById(budget.categoryId, categories);
      const category = categoryPath?.at(-1);
      if (!categoryPath || !category) return [];
      const ids = new Set(categorySubtreeIds(category));
      const names = new Set(categorySubtreeNames(category).map(normalizeCategoryLabel));
      const spent = yearlyTransactions
        .filter((transaction) => {
          if (transaction.type !== 'expense') return false;
          if (budget.period === 'monthly' && ledgerDateToDate(transactionLedgerDate(transaction, reportingTimeZone)).getMonth() !== currentMonth) {
            return false;
          }
          return transaction.categoryId
            ? ids.has(transaction.categoryId)
            : names.has(normalizeCategoryLabel(transaction.category));
        })
        .reduce(
          (sum, transaction) => sum + financialTransactionAmount(transaction),
          0,
        );

      return [{
        category: categoryPath.map((part) => part.name).join(' > '),
        amount: budget.amount,
        spent,
        period: budget.period,
      }];
    })
    .slice(0, 25);

  const terms = questionTerms(question);
  const matchingTransactions = yearlyTransactions
    .filter((transaction) => {
      if (!isFinancialTransaction(transaction)) return false;
      if (transaction.type === "transfer") return false;
      if (terms.length === 0) return false;
      const haystack = `${transaction.description} ${transaction.category}`.toLocaleLowerCase();
      return terms.some((term) => haystack.includes(term));
    })
    .slice(0, 20)
    .map(({ date, description, amount, type, category }) => ({
      date,
      description,
      amount: Math.abs(amount),
      type: type as "income" | "expense",
      category,
    }));

  return {
    year,
    summary: {
      income,
      expenses,
      net: income - expenses,
      transactionCount: new Set(yearlyTransactions.map(sourceTransactionId)).size,
    },
    topExpenseCategories: Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8),
    budgets: budgetContext,
    goals: goals.slice(0, 25).map(({ name, targetAmount, savedAmount, targetDate }) => ({
      name,
      targetAmount,
      savedAmount,
      ...(targetDate ? { targetDate } : {}),
    })),
    recurringScheduleCount: recurringTransactions.length,
    matchingTransactions,
  };
}
