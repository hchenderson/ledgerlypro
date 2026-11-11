import {
  categorySubtreeIds,
  findCategoryByIdRecursive,
} from "@/lib/category-tree";
import { expandTransactionAllocations } from "@/lib/transaction-allocations";
import type { Category, SubCategory, Transaction } from "@/types";

export const ALL_TRANSACTION_CATEGORIES = "all";
export const TRANSFER_TRANSACTION_CATEGORY = "__transfer__";

export interface TransactionCategoryOption {
  value: string;
  label: string;
}

/**
 * Builds ID-backed options with enough path context to distinguish categories
 * that have the same name in different branches.
 */
export function buildTransactionCategoryOptions(
  categories: Category[],
): TransactionCategoryOption[] {
  const options: TransactionCategoryOption[] = [];

  const walk = (
    items: Array<Category | SubCategory>,
    type: Category["type"],
    parentNames: string[],
  ) => {
    for (const category of items) {
      const path = [...parentNames, category.name];
      options.push({
        value: category.id,
        label: `${type === "income" ? "Income" : "Expense"} · ${path.join(" > ")}`,
      });
      if (category.subCategories?.length) {
        walk(category.subCategories, type, path);
      }
    }
  };

  for (const category of categories) {
    walk([category], category.type, []);
  }

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

/**
 * Filters source transactions once, even when more than one split allocation
 * belongs to the selected category subtree.
 */
export function filterTransactionsByCategory(
  transactions: Transaction[],
  selectedCategoryId: string,
  categories: Category[],
): Transaction[] {
  if (selectedCategoryId === ALL_TRANSACTION_CATEGORIES) {
    return transactions;
  }

  if (selectedCategoryId === TRANSFER_TRANSACTION_CATEGORY) {
    return transactions.filter((transaction) => transaction.type === "transfer");
  }

  const selectedCategory = findCategoryByIdRecursive(
    selectedCategoryId,
    categories,
  );
  if (!selectedCategory) return [];

  const selectedCategoryIds = new Set(categorySubtreeIds(selectedCategory));
  const includeLegacyUncategorized =
    selectedCategory.name.trim().toLocaleLowerCase() === "uncategorized";

  return transactions.filter((transaction) =>
    expandTransactionAllocations(transaction).some((entry) => {
      if (entry.type === "transfer") return false;
      if (
        entry.categoryId &&
        selectedCategoryIds.has(entry.categoryId)
      ) {
        return true;
      }

      // Uncategorized records historically have no category ID. Keep that
      // behavior (including stale IDs) without falling back to names for
      // ordinary categories.
      return (
        includeLegacyUncategorized &&
        entry.category.trim().toLocaleLowerCase() === "uncategorized"
      );
    }),
  );
}
