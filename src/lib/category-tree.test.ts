import { describe, expect, it } from 'vitest';

import {
  categorySubtreeIds,
  findMainCategoryForTransaction,
} from './category-tree';
import type { Category, Transaction } from '@/types';

const categories: Category[] = [{
  id: 'food',
  name: 'Food & Dining',
  type: 'expense',
  subCategories: [{ id: 'groceries', name: 'Groceries' }],
}];

describe('category ID resolution', () => {
  it('uses the category ID even when a stored display label is stale', () => {
    const transaction = {
      categoryId: 'groceries',
      category: 'Old Grocery Name',
    } satisfies Pick<Transaction, 'category' | 'categoryId'>;

    expect(findMainCategoryForTransaction(transaction, categories)).toBe('Food & Dining');
  });

  it('returns every ID in a nested category subtree', () => {
    expect(categorySubtreeIds(categories[0])).toEqual(['food', 'groceries']);
  });
});
