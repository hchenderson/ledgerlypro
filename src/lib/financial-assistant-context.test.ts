import { describe, expect, it } from 'vitest';

import { buildFinancialAssistantContext } from './financial-assistant-context';
import type { Budget, Category, Transaction } from '@/types';

const categories: Category[] = [{
  id: 'food',
  name: 'Food',
  type: 'expense',
  subCategories: [{ id: 'groceries', name: 'Groceries' }],
}];

const transactions: Transaction[] = [
  {
    id: 'salary',
    date: '2026-01-01T12:00:00.000Z',
    description: 'Salary',
    amount: 5_000,
    type: 'income',
    category: 'Income',
  },
  {
    id: 'market',
    date: '2026-07-01T12:00:00.000Z',
    description: 'Neighborhood Market 1774',
    amount: 100,
    type: 'expense',
    category: 'Stale label',
    categoryId: 'groceries',
  },
  {
    id: 'old',
    date: '2025-07-01T12:00:00.000Z',
    description: 'Old expense',
    amount: 999,
    type: 'expense',
    category: 'Groceries',
  },
];

const budgets: Budget[] = [{
  id: 'budget',
  categoryId: 'groceries',
  amount: 400,
  period: 'monthly',
  year: 2026,
}];

describe('buildFinancialAssistantContext', () => {
  it('scopes totals to the requested year and exposes only bounded matching transactions', () => {
    const context = buildFinancialAssistantContext({
      transactions,
      categories,
      budgets,
      goals: [],
      recurringTransactions: [],
      question: 'Find transaction 1774',
      year: 2026,
    });

    expect(context.summary).toEqual({
      income: 5_000,
      expenses: 100,
      net: 4_900,
      transactionCount: 2,
    });
    expect(context.topExpenseCategories).toEqual([{ category: 'Food', amount: 100 }]);
    expect(context.matchingTransactions).toHaveLength(1);
    expect(context.matchingTransactions[0].description).toContain('1774');
  });
});
