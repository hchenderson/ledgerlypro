import type { Category, SubCategory, Transaction } from "@/types";

export type CategoryTreeItem = Category | SubCategory;
export type CategoryNode = CategoryTreeItem;

export function getCategorySubtreeIdsAndNames(
  category: CategoryTreeItem,
): { ids: string[]; names: string[] } {
  const ids: string[] = [];
  const names: string[] = [];

  const walk = (item: CategoryTreeItem) => {
    if (item.id) ids.push(item.id);
    if (item.name) names.push(item.name);
    item.subCategories?.forEach(walk);
  };

  walk(category);
  return { ids, names };
}

export function findCategoryByIdRecursive(
  id: string,
  categories: CategoryTreeItem[],
): CategoryTreeItem | undefined {
  for (const category of categories) {
    if (category.id === id) return category;
    if (category.subCategories) {
      const found = findCategoryByIdRecursive(id, category.subCategories);
      if (found) return found;
    }
  }
  return undefined;
}

export function findCategoryByPath(
  path: string,
  categories: Category[],
  type?: Transaction["type"],
): CategoryTreeItem | undefined {
  const parts = path
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;

  const search = (
    items: CategoryTreeItem[],
    index: number,
  ): CategoryTreeItem | undefined => {
    for (const item of items) {
      if (item.name.toLowerCase() !== parts[index].toLowerCase()) continue;
      if (index === parts.length - 1) return item;
      if (item.subCategories) {
        const found = search(item.subCategories, index + 1);
        if (found) return found;
      }
    }
    return undefined;
  };

  const roots = type
    ? categories.filter((category) => category.type === type)
    : categories;
  const exactPathMatch = search(roots, 0);
  if (exactPathMatch) return exactPathMatch;

  const targetLeaf = parts.at(-1)?.toLowerCase();
  const findLeaf = (
    items: CategoryTreeItem[],
  ): CategoryTreeItem | undefined => {
    for (const item of items) {
      if (item.name.toLowerCase() === targetLeaf) return item;
      const nested = item.subCategories
        ? findLeaf(item.subCategories)
        : undefined;
      if (nested) return nested;
    }
    return undefined;
  };

  return findLeaf(roots);
}

export function findCategoryWithPathById(
  id: string,
  categories: CategoryTreeItem[],
  path: CategoryTreeItem[] = [],
):
  | { category: CategoryTreeItem; path: CategoryTreeItem[] }
  | undefined {
  for (const category of categories) {
    const nextPath = [...path, category];
    if (category.id === id) {
      return { category, path: nextPath };
    }
    if (category.subCategories) {
      const found = findCategoryWithPathById(
        id,
        category.subCategories,
        nextPath,
      );
      if (found) return found;
    }
  }
  return undefined;
}

export function buildCategoryPathLabel(
  id: string,
  categories: Category[],
  replacementName?: string,
): string | undefined {
  const result = findCategoryWithPathById(id, categories);
  if (!result) return undefined;
  return result.path
    .map((category) =>
      category.id === id && replacementName
        ? replacementName
        : category.name,
    )
    .join(" > ");
}

export function findCategoryPathById(
  id: string,
  categories: Category[],
): CategoryTreeItem[] | undefined {
  return findCategoryWithPathById(id, categories)?.path;
}

export function categorySubtreeIds(
  category: CategoryTreeItem,
): string[] {
  return getCategorySubtreeIdsAndNames(category).ids;
}

export function categorySubtreeNames(
  category: CategoryTreeItem,
): string[] {
  return getCategorySubtreeIdsAndNames(category).names;
}

export function normalizeCategoryName(name: string): string {
  if (!name) return "";
  return name
    .split(">")
    .map((part) => part.trim())
    .at(-1) ?? "";
}

export function normalizeCategoryLabel(name: string): string {
  return normalizeCategoryName(name) || name;
}

export function findMainCategoryName(
  label: string,
  categories: Category[],
): string {
  const target = normalizeCategoryLabel(label).toLowerCase();

  for (const mainCategory of categories) {
    if (
      categorySubtreeNames(mainCategory).some(
        (name) => name.toLowerCase() === target,
      )
    ) {
      return mainCategory.name;
    }
  }

  return "Uncategorized";
}

export function findMainCategoryForTransaction(
  transaction: Pick<Transaction, "category" | "categoryId">,
  categories: Category[],
): string {
  if (transaction.categoryId) {
    const path = findCategoryPathById(
      transaction.categoryId,
      categories,
    );
    if (path?.[0]) return path[0].name;
  }

  return findMainCategoryName(transaction.category, categories);
}
