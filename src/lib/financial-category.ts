import {
  findCategoryByPath,
  findCategoryPathById,
  findMainCategoryForTransaction,
  findCategoryWithPathById,
} from "@/lib/category-tree";
import type { Category, SubCategory, Transaction } from "@/types";

export interface FinancialCategoryOption {
  value: string;
  label: string;
}

function categoryPathForTransaction(
  transaction: Pick<Transaction, "type" | "category" | "categoryId">,
  categories: Category[],
): Array<Category | SubCategory> | undefined {
  if (transaction.type !== "income" && transaction.type !== "expense") {
    return undefined;
  }

  if (transaction.categoryId) {
    const path = findCategoryPathById(transaction.categoryId, categories);
    const root = path?.[0] as Category | undefined;
    if (root?.type === transaction.type) return path;
  }

  const matchedCategory = findCategoryByPath(
    transaction.category,
    categories,
    transaction.type,
  );
  return matchedCategory?.id
    ? findCategoryWithPathById(matchedCategory.id, categories)?.path
    : undefined;
}

export function financialCategoryPathKeys(
  transaction: Pick<Transaction, "type" | "category" | "categoryId">,
  categories: Category[],
): string[] {
  if (transaction.type !== "income" && transaction.type !== "expense") {
    return [];
  }

  const path = categoryPathForTransaction(transaction, categories);
  if (path?.length) {
    return path.map((category) => `${transaction.type}:${category.id}`);
  }

  return [`${transaction.type}:uncategorized`];
}

export function buildFinancialCategoryOptions(
  categories: Category[],
): FinancialCategoryOption[] {
  const options: FinancialCategoryOption[] = [];

  const walk = (
    items: Array<Category | SubCategory>,
    type: "income" | "expense",
    parentNames: string[],
  ) => {
    for (const category of items) {
      const path = [...parentNames, category.name];
      options.push({
        value: `${type}:${category.id}`,
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

  return [
    ...options.sort((left, right) => left.label.localeCompare(right.label)),
    { value: "expense:uncategorized", label: "Expense · Uncategorized" },
    { value: "income:uncategorized", label: "Income · Uncategorized" },
  ];
}

export function financialCategoryKey(
  transaction: Pick<Transaction, "type" | "category" | "categoryId">,
  categories: Category[],
): string | null {
  if (transaction.type !== "income" && transaction.type !== "expense") {
    return null;
  }

  const pathKey = financialCategoryPathKeys(transaction, categories)[0];
  if (pathKey && !pathKey.endsWith(":uncategorized")) return pathKey;

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
