import {
  findCategoryWithPathById,
  normalizeCategoryName,
  type CategoryTreeItem,
} from "@/lib/category-tree";
import { financialTransactionAmount } from "@/lib/financial-summary";
import type { Category, Transaction } from "@/types";

export type FinancialCategoryResolution = {
  key: string;
  label: string;
  categoryId: string | null;
  rootKey: string;
  rootLabel: string;
  rootCategoryId: string | null;
  status: "resolved" | "uncategorized" | "unresolved";
};

export type FinancialCategoryBreakdownRow = FinancialCategoryResolution & {
  amount: number;
  share: number;
};

function pathLabel(path: CategoryTreeItem[]) {
  return path.map((category) => category.name).join(" > ");
}

function unresolvedLabel(transaction: Pick<Transaction, "category" | "categoryId">) {
  const stored = transaction.category?.trim();
  return stored && stored.toLocaleLowerCase() !== "uncategorized"
    ? `Unresolved · ${stored}`
    : transaction.categoryId
      ? `Unresolved category · ${transaction.categoryId}`
      : "Uncategorized";
}

function findUniqueLegacyPath(
  storedName: string,
  categories: Category[],
  type: "income" | "expense",
): CategoryTreeItem[] | undefined {
  const targetPath = storedName
    .split(">")
    .map((part) => part.trim().toLocaleLowerCase())
    .filter(Boolean);
  const matches: CategoryTreeItem[][] = [];
  const walk = (items: CategoryTreeItem[], path: CategoryTreeItem[]) => {
    for (const item of items) {
      const nextPath = [...path, item];
      const names = nextPath.map((part) => part.name.trim().toLocaleLowerCase());
      const exactPath =
        targetPath.length > 1 && names.join("::") === targetPath.join("::");
      const uniqueLeafCandidate =
        targetPath.length === 1 && names.at(-1) === targetPath[0];
      if (exactPath || uniqueLeafCandidate) matches.push(nextPath);
      if (item.subCategories) walk(item.subCategories, nextPath);
    }
  };
  for (const root of categories.filter((category) => category.type === type)) {
    walk([root], []);
  }
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Resolve a financial category by stable ID first. A stale label on a
 * transaction therefore follows a renamed category. Legacy name-only records
 * resolve only when the current tree identifies one unambiguous category;
 * unknown or deleted IDs stay visible in an explicit unresolved bucket.
 */
export function resolveFinancialCategory(
  transaction: Pick<Transaction, "type" | "category" | "categoryId">,
  categories: Category[],
): FinancialCategoryResolution | null {
  if (transaction.type !== "income" && transaction.type !== "expense") {
    return null;
  }
  const prefix = transaction.type;
  if (transaction.categoryId) {
    const found = findCategoryWithPathById(transaction.categoryId, categories);
    const root = found?.path[0] as Category | undefined;
    if (found && root?.type === transaction.type) {
      return {
        key: `${prefix}:${found.category.id}`,
        label: pathLabel(found.path),
        categoryId: found.category.id,
        rootKey: `${prefix}:${root.id}`,
        rootLabel: root.name,
        rootCategoryId: root.id,
        status: "resolved",
      };
    }
    return {
      key: `${prefix}:unresolved-id:${transaction.categoryId}`,
      label: unresolvedLabel(transaction),
      categoryId: transaction.categoryId,
      rootKey: `${prefix}:unresolved-id:${transaction.categoryId}`,
      rootLabel: unresolvedLabel(transaction),
      rootCategoryId: null,
      status: "unresolved",
    };
  }

  const storedName = transaction.category?.trim();
  if (storedName && storedName.toLocaleLowerCase() !== "uncategorized") {
    const legacyPath = findUniqueLegacyPath(
      storedName,
      categories,
      transaction.type,
    );
    const matched = legacyPath?.at(-1);
    const root = legacyPath?.[0] as Category | undefined;
    if (legacyPath && matched?.id && root?.type === transaction.type) {
      return {
        key: `${prefix}:${matched.id}`,
        label: pathLabel(legacyPath),
        categoryId: matched.id,
        rootKey: `${prefix}:${root.id}`,
        rootLabel: root.name,
        rootCategoryId: root.id,
        status: "resolved",
      };
    }
    const normalized = normalizeCategoryName(storedName).toLocaleLowerCase();
    return {
      key: `${prefix}:unresolved-name:${normalized}`,
      label: unresolvedLabel(transaction),
      categoryId: null,
      rootKey: `${prefix}:unresolved-name:${normalized}`,
      rootLabel: unresolvedLabel(transaction),
      rootCategoryId: null,
      status: "unresolved",
    };
  }

  return {
    key: `${prefix}:uncategorized`,
    label: "Uncategorized",
    categoryId: null,
    rootKey: `${prefix}:uncategorized`,
    rootLabel: "Uncategorized",
    rootCategoryId: null,
    status: "uncategorized",
  };
}

export function buildFinancialCategoryBreakdown(
  transactions: Transaction[],
  type: "income" | "expense",
  categories: Category[],
  level: "category" | "root" = "category",
): FinancialCategoryBreakdownRow[] {
  const totals = new Map<
    string,
    Omit<FinancialCategoryBreakdownRow, "amount" | "share"> & { amount: number }
  >();
  for (const transaction of transactions) {
    if (transaction.type !== type) continue;
    const resolution = resolveFinancialCategory(transaction, categories);
    if (!resolution) continue;
    const key = level === "root" ? resolution.rootKey : resolution.key;
    const existing = totals.get(key);
    const row = level === "root"
      ? {
          ...resolution,
          key: resolution.rootKey,
          label: resolution.rootLabel,
          categoryId: resolution.rootCategoryId,
          amount: (existing?.amount ?? 0) + financialTransactionAmount(transaction),
        }
      : {
          ...resolution,
          amount: (existing?.amount ?? 0) + financialTransactionAmount(transaction),
        };
    totals.set(key, row);
  }
  const overall = [...totals.values()].reduce((sum, row) => sum + row.amount, 0);
  return [...totals.values()]
    .map((row) => ({
      ...row,
      share: overall > 0 ? (row.amount / overall) * 100 : 0,
    }))
    .sort((left, right) => right.amount - left.amount || left.key.localeCompare(right.key));
}
