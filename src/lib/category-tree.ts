import type { Category, SubCategory, Transaction } from "@/types";

export type CategoryNode = Category | SubCategory;

export function categorySubtreeNames(category: CategoryNode): string[] {
  return [
    category.name,
    ...(category.subCategories?.flatMap(categorySubtreeNames) ?? []),
  ];
}

export function categorySubtreeIds(category: CategoryNode): string[] {
  return [
    category.id,
    ...(category.subCategories?.flatMap(categorySubtreeIds) ?? []),
  ].filter((id): id is string => Boolean(id));
}

export function findCategoryPathById(
  id: string,
  categories: Category[]
): CategoryNode[] | undefined {
  const walk = (nodes: CategoryNode[], path: CategoryNode[]): CategoryNode[] | undefined => {
    for (const node of nodes) {
      const nextPath = [...path, node];
      if (node.id === id) return nextPath;
      const nested = node.subCategories
        ? walk(node.subCategories, nextPath)
        : undefined;
      if (nested) return nested;
    }
    return undefined;
  };

  return walk(categories, []);
}

export function normalizeCategoryLabel(label: string): string {
  return label.split(">").map((part) => part.trim()).filter(Boolean).at(-1) ?? label;
}

export function findMainCategoryName(
  label: string,
  categories: Category[]
): string {
  const target = normalizeCategoryLabel(label).toLocaleLowerCase();

  for (const mainCategory of categories) {
    if (
      categorySubtreeNames(mainCategory).some(
        (name) => name.toLocaleLowerCase() === target
      )
    ) {
      return mainCategory.name;
    }
  }

  return "Uncategorized";
}

export function findMainCategoryForTransaction(
  transaction: Pick<Transaction, "category" | "categoryId">,
  categories: Category[]
): string {
  if (transaction.categoryId) {
    const path = findCategoryPathById(transaction.categoryId, categories);
    if (path?.[0]) return path[0].name;
  }

  return findMainCategoryName(transaction.category, categories);
}
