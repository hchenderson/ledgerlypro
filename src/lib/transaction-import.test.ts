import { describe, expect, it } from 'vitest';

import { prepareTransactionImport } from './transaction-import';
import type { Transaction } from '@/types';

const existing: Transaction = {
  id: 'existing',
  date: '2026-07-01T12:00:00.000Z',
  description: 'Neighborhood Market',
  amount: 42.15,
  type: 'expense',
  category: 'Groceries',
  categoryId: 'groceries',
};

describe('prepareTransactionImport', () => {
  it('skips probable duplicates already stored and repeated inside the CSV', () => {
    const newTransaction: Omit<Transaction, 'id'> = {
      date: '2026-07-02T12:00:00.000Z',
      description: 'Coffee Shop',
      amount: 5,
      type: 'expense',
      category: 'Dining',
    };
    const { id: _existingId, ...existingWithoutId } = existing;
    const result = prepareTransactionImport([
      existingWithoutId,
      newTransaction,
      { ...newTransaction, description: '  COFFEE   SHOP ' },
    ], [existing]);

    expect(result.transactions).toEqual([newTransaction]);
    expect(result.duplicates).toBe(2);
  });

  it('allows the same bank entry in a different account', () => {
    const checkingTransaction = {
      ...existing,
      accountId: 'checking',
    };
    const { id: _id, ...candidate } = checkingTransaction;
    const result = prepareTransactionImport(
      [{ ...candidate, accountId: 'savings' }],
      [checkingTransaction],
    );

    expect(result.transactions).toHaveLength(1);
    expect(result.duplicates).toBe(0);
  });
});
