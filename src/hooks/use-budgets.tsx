"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getYear } from "date-fns";

import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import {
  useFirestoreUserCollection,
  userCollectionRef,
} from "@/hooks/use-firestore-user-collection";
import { chunkArray } from "@/lib/batching";
import {
  findCategoryByIdRecursive,
  findCategoryWithPathById,
  getCategorySubtreeIdsAndNames,
  normalizeCategoryName,
} from "@/lib/category-tree";
import { db } from "@/lib/firebase";
import { transactionAmount } from "@/lib/financial-summary";
import type { Budget, Category, Transaction } from "@/types";

export interface BudgetDetails extends Budget {
  categoryName: string;
  spent: number;
  remaining: number;
  progress: number;
  deltas: {
    amount: number;
    spent: number;
    remaining: number;
  } | null;
}

interface GetBudgetDetailsParams {
  activeBudgets: Budget[];
  comparisonBudgets?: Budget[];
  transactions: Transaction[];
  categories: Category[];
  forDate: Date;
  comparisonYear?: number;
}

export interface BudgetsContextType {
  budgets: Budget[];
  loading: boolean;
  error: Error | null;
  addBudget: (budget: Omit<Budget, "id">) => Promise<void>;
  updateBudget: (
    id: string,
    values: Partial<Omit<Budget, "id">>,
  ) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  toggleFavoriteBudget: (id: string) => Promise<void>;
  getBudgetDetails: (
    params: GetBudgetDetailsParams,
  ) => BudgetDetails[];
}

const BudgetsContext = createContext<BudgetsContextType | null>(null);

export function calculateBudgetDetails(
  {
    activeBudgets,
    comparisonBudgets = [],
    transactions,
    categories,
    forDate,
    comparisonYear,
  }: GetBudgetDetailsParams,
  firstYear: number,
): BudgetDetails[] {
  const reportYear = getYear(forDate);

  const findFirstTransactionYearForBudget = (
    allTransactions: Transaction[],
    categoryIds: string[],
    categoryNames: string[],
  ) => {
    const budgetTransactions = allTransactions
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          (transaction.categoryId
            ? categoryIds.includes(transaction.categoryId)
            : categoryNames.includes(transaction.category)),
      )
      .sort(
        (first, second) =>
          new Date(first.date).getTime() -
          new Date(second.date).getTime(),
      );

    return budgetTransactions.length > 0
      ? getYear(new Date(budgetTransactions[0].date))
      : null;
  };

  const relevantBudgets = activeBudgets.filter((budget) => {
    let effectiveYear = budget.year;
    if (typeof effectiveYear !== "number") {
      const category = findCategoryByIdRecursive(
        budget.categoryId,
        categories,
      );
      const subtree = category
        ? getCategorySubtreeIdsAndNames(category)
        : { ids: [], names: [] };
      effectiveYear =
        findFirstTransactionYearForBudget(
          transactions,
          subtree.ids,
          subtree.names,
        ) ?? firstYear;
    }
    return effectiveYear === reportYear;
  });

  const calculateSpending = (
    budget: Budget,
    categoryIds: string[],
    categoryNames: string[],
    currentDate: Date,
    year: number,
  ) =>
    transactions
      .filter((transaction) => {
        const transactionDate = new Date(transaction.date);
        if (getYear(transactionDate) !== year) return false;
        if (transaction.type !== "expense") return false;

        const categoryMatches = transaction.categoryId
          ? categoryIds.includes(transaction.categoryId)
          : categoryNames.includes(
              normalizeCategoryName(transaction.category),
            );
        if (!categoryMatches) return false;

        if (budget.period === "monthly") {
          return transactionDate.getMonth() === currentDate.getMonth();
        }
        return budget.period === "yearly";
      })
      .reduce(
        (sum, transaction) => sum + transactionAmount(transaction),
        0,
      );

  return relevantBudgets.map((budget) => {
    const categoryResult = findCategoryWithPathById(
      budget.categoryId,
      categories,
    );
    const categoryName = categoryResult
      ? categoryResult.path.map((category) => category.name).join(" > ")
      : "Unknown Category";
    const subtree = categoryResult
      ? getCategorySubtreeIdsAndNames(categoryResult.category)
      : { ids: [], names: [] };
    const spent = calculateSpending(
      budget,
      subtree.ids,
      subtree.names,
      forDate,
      reportYear,
    );
    const remaining = budget.amount - spent;
    const progress =
      budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    let deltas: BudgetDetails["deltas"] = null;
    if (comparisonYear && comparisonBudgets.length > 0) {
      const comparisonBudget = comparisonBudgets.find(
        (candidate) =>
          candidate.categoryId === budget.categoryId &&
          candidate.period === budget.period,
      );
      if (comparisonBudget) {
        const comparisonDate = new Date(
          comparisonYear,
          forDate.getMonth(),
          1,
        );
        const comparisonSpent = calculateSpending(
          comparisonBudget,
          subtree.ids,
          subtree.names,
          comparisonDate,
          comparisonYear,
        );
        deltas = {
          amount: budget.amount - comparisonBudget.amount,
          spent: spent - comparisonSpent,
          remaining:
            remaining - (comparisonBudget.amount - comparisonSpent),
        };
      }
    }

    return {
      ...budget,
      categoryName,
      spent,
      remaining,
      progress,
      deltas,
    };
  });
}

export function BudgetsProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const { user, firstYear } = useAuth();
  const { categories, loading: categoriesLoading } = useCategories();
  const {
    items: budgets,
    loading,
    error,
    collectionRef,
  } = useFirestoreUserCollection<Budget>("budgets", { enabled });
  const migrationUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      migrationUserRef.current = null;
      return;
    }
    if (
      !enabled ||
      loading ||
      categoriesLoading ||
      migrationUserRef.current === user.uid
    ) {
      return;
    }

    const budgetsToMigrate = budgets.filter(
      (budget) => typeof budget.year !== "number",
    );
    migrationUserRef.current = user.uid;
    if (budgetsToMigrate.length === 0) return;

    const migrateBudgets = async () => {
      const transactionsSnapshot = await getDocs(
        query(userCollectionRef(user.uid, "transactions")),
      );
      const transactions = transactionsSnapshot.docs.map(
        (snapshot) =>
          ({
            ...snapshot.data(),
            id: snapshot.id,
          }) as Transaction,
      );

      const updates = budgetsToMigrate.map((budget) => {
        const category = findCategoryByIdRecursive(
          budget.categoryId,
          categories,
        );
        const subtree = category
          ? getCategorySubtreeIdsAndNames(category)
          : { ids: [], names: [] };
        const budgetTransactions = transactions
          .filter(
            (transaction) =>
              transaction.type === "expense" &&
              (transaction.categoryId
                ? subtree.ids.includes(transaction.categoryId)
                : subtree.names.includes(transaction.category)),
          )
          .sort(
            (first, second) =>
              new Date(first.date).getTime() -
              new Date(second.date).getTime(),
          );
        return {
          id: budget.id,
          year:
            budgetTransactions.length > 0
              ? getYear(new Date(budgetTransactions[0].date))
              : firstYear,
        };
      });

      const budgetsRef = userCollectionRef(user.uid, "budgets");
      for (const updateChunk of chunkArray(updates, 450)) {
        const batch = writeBatch(db);
        updateChunk.forEach((update) => {
          batch.update(doc(budgetsRef, update.id), {
            year: update.year,
          });
        });
        await batch.commit();
      }
      console.info(
        `Successfully migrated ${updates.length} legacy budgets.`,
      );
    };

    void migrateBudgets().catch((migrationError) => {
      migrationUserRef.current = null;
      console.error("Budget migration failed:", migrationError);
    });
  }, [
    budgets,
    categories,
    categoriesLoading,
    enabled,
    firstYear,
    loading,
    user,
  ]);

  const addBudget = useCallback(
    async (budget: Omit<Budget, "id">) => {
      if (!collectionRef) return;
      const newDocumentRef = doc(collectionRef);
      await setDoc(newDocumentRef, {
        ...budget,
        id: newDocumentRef.id,
      });
    },
    [collectionRef],
  );

  const updateBudget = useCallback(
    async (
      id: string,
      values: Partial<Omit<Budget, "id">>,
    ) => {
      if (!collectionRef) return;
      await setDoc(doc(collectionRef, id), values, { merge: true });
    },
    [collectionRef],
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      if (!collectionRef) return;
      await deleteDoc(doc(collectionRef, id));
    },
    [collectionRef],
  );

  const toggleFavoriteBudget = useCallback(
    async (id: string) => {
      if (!collectionRef) return;
      const budgetDocumentRef = doc(collectionRef, id);
      const budgetSnapshot = await getDoc(budgetDocumentRef);
      if (!budgetSnapshot.exists()) return;
      await setDoc(
        budgetDocumentRef,
        { isFavorite: !budgetSnapshot.data().isFavorite },
        { merge: true },
      );
    },
    [collectionRef],
  );

  const getBudgetDetails = useCallback(
    (params: GetBudgetDetailsParams) =>
      calculateBudgetDetails(params, firstYear),
    [firstYear],
  );

  const value = useMemo<BudgetsContextType>(
    () => ({
      budgets,
      loading,
      error,
      addBudget,
      updateBudget,
      deleteBudget,
      toggleFavoriteBudget,
      getBudgetDetails,
    }),
    [
      addBudget,
      budgets,
      deleteBudget,
      error,
      getBudgetDetails,
      loading,
      toggleFavoriteBudget,
      updateBudget,
    ],
  );

  return (
    <BudgetsContext.Provider value={value}>
      {children}
    </BudgetsContext.Provider>
  );
}

export function useBudgets(): BudgetsContextType {
  const context = useContext(BudgetsContext);
  if (!context) {
    throw new Error(
      "useBudgets must be used within BudgetsProvider",
    );
  }
  return context;
}
