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
import { transactionAmount } from '@/lib/financial-summary';

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
}: {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: Goal[];
  recurringTransactions: RecurringTransaction[];
  question: string;
  year?: number;
}): FinancialAssistantContext {
  const yearlyTransactions = transactions.filter((transaction) => {
    const date = new Date(transaction.date);
    return (
      !Number.isNaN(date.getTime()) &&
      date.getUTCFullYear() === year &&
      transaction.type !== "transfer"
    );
  });
  const income = yearlyTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transactionAmount(transaction), 0);
  const expenses = yearlyTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transactionAmount(transaction), 0);

  const categoryTotals = yearlyTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce<Record<string, number>>((totals, transaction) => {
      const category = findMainCategoryForTransaction(transaction, categories);
      totals[category] =
        (totals[category] ?? 0) + transactionAmount(transaction);
      return totals;
    }, {});

  const currentMonth = new Date().getUTCMonth();
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
          if (budget.period === 'monthly' && new Date(transaction.date).getUTCMonth() !== currentMonth) {
            return false;
          }
          return transaction.categoryId
            ? ids.has(transaction.categoryId)
            : names.has(normalizeCategoryLabel(transaction.category));
        })
        .reduce(
          (sum, transaction) => sum + transactionAmount(transaction),
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
  const matchingTransactions = transactions
    .filter((transaction) => {
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
      transactionCount: yearlyTransactions.length,
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
