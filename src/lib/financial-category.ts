import {
  findCategoryPathById,
  findMainCategoryForTransaction,
} from "@/lib/category-tree";
import type { Category, Transaction } from "@/types";

export function financialCategoryKey(
  transaction: Pick<Transaction, "type" | "category" | "categoryId">,
  categories: Category[],
): string | null {
  if (transaction.type !== "income" && transaction.type !== "expense") {
    return null;
  }

  const rootFromId = transaction.categoryId
    ? findCategoryPathById(transaction.categoryId, categories)?.[0]
    : undefined;
  if (rootFromId?.id) return `${transaction.type}:${rootFromId.id}`;

  const mainCategory = findMainCategoryForTransaction(
    transaction,
    categories,
  );
  const rootFromName = categories.find(
    (category) =>
      category.type === transaction.type &&
      category.name.toLocaleLowerCase() ===
        mainCategory.toLocaleLowerCase(),
  );
  return rootFromName?.id
    ? `${transaction.type}:${rootFromName.id}`
    : `${transaction.type}:uncategorized`;
}

export function financialCategoryLabel(
  transaction: Pick<Transaction, "type" | "category" | "categoryId">,
  categories: Category[],
): string {
  return findMainCategoryForTransaction(transaction, categories);
}
