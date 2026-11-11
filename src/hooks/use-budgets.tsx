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
import { canonicalMoneyFields } from "@/lib/money";
import {
  calculateBudgetDetails,
  type BudgetDetails,
  type GetBudgetDetailsParams,
} from "@/lib/budget-analytics";
import {
  findCategoryByIdRecursive,
  getCategorySubtreeIdsAndNames,
} from "@/lib/category-tree";
import { db } from "@/lib/firebase";
import type { Budget, Transaction } from "@/types";

export {
  calculateBudgetDetails,
  type BudgetDetails,
  type GetBudgetDetailsParams,
} from "@/lib/budget-analytics";

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
        ...canonicalMoneyFields(budget.amount),
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
      await setDoc(doc(collectionRef, id), {
        ...values,
        ...(values.amount !== undefined ? canonicalMoneyFields(values.amount) : {}),
      }, { merge: true });
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
