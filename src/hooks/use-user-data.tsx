
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  writeBatch,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import type { Transaction, Category, SubCategory, Budget, RecurringTransaction, Goal, ProcessedGoal } from '@/types';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase';
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isBefore,
  startOfDay,
  parseISO,
  isToday,
} from 'date-fns';

interface UserDataContextType {
  allTransactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
  goals: ProcessedGoal[];
  loading: boolean;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (id: string, values: Partial<Omit<Transaction, 'id'>>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category>;
  addSubCategory: (parentId: string, subCategory: Omit<SubCategory, 'id'>, parentPath?: string[]) => Promise<SubCategory>;
  updateCategory: (id: string, oldName: string, newName: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateSubCategory: (categoryId: string, subCategoryId: string, oldName: string, newName: string, parentPath?: string[]) => Promise<void>;
  deleteSubCategory: (categoryId: string, subCategoryId: string, parentPath?: string[]) => Promise<void>;
  addBudget: (budget: Omit<Budget, 'id'>) => Promise<void>;
  updateBudget: (id: string, values: Partial<Omit<Budget, 'id'>>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  toggleFavoriteBudget: (id: string) => Promise<void>;
  addRecurringTransaction: (transaction: Omit<RecurringTransaction, 'id'>) => Promise<void>;
  updateRecurringTransaction: (id: string, values: Partial<Omit<RecurringTransaction, 'id'>>) => Promise<void>;
  deleteRecurringTransaction: (id: string) => Promise<void>;
  getBudgetDetails: (forDate?: Date) => any[];
  addGoal: (goal: Omit<Goal, 'id'>) => Promise<void>;
  updateGoal: (id: string, values: Partial<Omit<Goal, 'id'>>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addContributionToGoal: (goalId: string, amount: number) => Promise<void>;
  clearTransactions: () => Promise<void>;
  clearAllData: () => Promise<void>;
  clearTransactionsByDateRange: (startDate: Date, endDate: Date) => Promise<void>;
  importCategories: (importedData: { name: string; type: 'income' | 'expense'; parent_name: string }[]) => Promise<void>;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

// ---------- Category Helpers ----------
const normalizeCategoryName = (name: string): string => {
  if (!name) return '';
  return name.split(">").map(n => n.trim()).pop()!;
};

// Recursively collect *all* subcategory names (for legacy path matching if needed)
const collectSubCategoryNames = (category: Category | SubCategory): string[] => {
  let names = [category.name];
  if (category.subCategories) {
    for (const sub of category.subCategories) {
      names = names.concat(collectSubCategoryNames(sub));
    }
  }
  return names;
};

const getCategorySubtreeIdsAndNames = (
  category: Category | SubCategory
): { ids: string[]; names: string[] } => {
  const ids: string[] = [];
  const names: string[] = [];

  const walk = (cat: Category | SubCategory) => {
    if (cat.id) ids.push(cat.id);
    if (cat.name) names.push(cat.name);
    if (cat.subCategories) {
      cat.subCategories.forEach(walk);
    }
  };

  walk(category);
  return { ids, names };
};


// Recursively collect *all* IDs for a category and its descendants
const collectSubCategoryIds = (category: Category | SubCategory): string[] => {
  let ids = [category.id];
  if (category.subCategories) {
    for (const sub of category.subCategories) {
      ids = ids.concat(collectSubCategoryIds(sub));
    }
  }
  return ids;
};

// Find a category/subcategory by ID in the tree
const findCategoryByIdRecursive = (
  id: string,
  cats: (Category | SubCategory)[]
): Category | SubCategory | undefined => {
  for (const cat of cats) {
    if (cat.id === id) return cat;
    if (cat.subCategories) {
      const found = findCategoryByIdRecursive(id, cat.subCategories);
      if (found) return found;
    }
  }
  return undefined;
};

// Find category by a "path" string like "Parent > Child > Sub"
// used for migrating legacy transactions
const findCategoryByPath = (
  path: string,
  cats: Category[]
): Category | SubCategory | undefined => {
  const parts = path
    .split('>')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;

  const search = (items: (Category | SubCategory)[], idx: number): Category | SubCategory | undefined => {
    for (const item of items) {
      if (item.name.toLowerCase() === parts[idx].toLowerCase()) {
        if (idx === parts.length - 1) return item;
        if (item.subCategories) {
          const found = search(item.subCategories, idx + 1);
          if (found) return found;
        }
      }
    }
    return undefined;
  };

  return search(cats, 0);
};

// Find category *and* path of names by ID
const findCategoryWithPathById = (
  id: string,
  cats: Category[],
  path: (Category | SubCategory)[] = []
): { category: Category | SubCategory; path: (Category | SubCategory)[] } | undefined => {
  for (const cat of cats) {
    const newPath = [...path, cat];
    if (cat.id === id) {
      return { category: cat, path: newPath };
    }
    if (cat.subCategories) {
      const found = findCategoryWithPathById(id, cat.subCategories as any, newPath);
      if (found) return found;
    }
  }
  return undefined;
};

// Build a display label like "Parent > Child > Sub"
const buildCategoryPathLabel = (id: string, categories: Category[]): string | undefined => {
  const result = findCategoryWithPathById(id, categories);
  if (!result) return undefined;
  return result.path.map((c) => c.name).join(' > ');
};

export const UserDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const getCollectionRef = useCallback(
    (collectionName: string) => {
      if (!user) return null;
      return collection(db, 'users', user.uid, collectionName);
    },
    [user]
  );

  // ---------- Recurring transactions ----------

  const processRecurringTransactions = useCallback(async () => {
    if (!user || recurringTransactions.length === 0) return;

    const today = startOfDay(new Date());
    const batch = writeBatch(db);
    let transactionsAdded = false;
    const transactionsCollRef = getCollectionRef('transactions');
    const recurringCollRef = getCollectionRef('recurringTransactions');

    if (!transactionsCollRef || !recurringCollRef) return;

    for (const rt of recurringTransactions) {
      try {
        const startDate = startOfDay(parseISO(rt.startDate));
        let lastAdded = rt.lastAddedDate ? startOfDay(parseISO(rt.lastAddedDate)) : null;

        let nextDate = lastAdded;

        if (!nextDate) {
          nextDate = startDate;
        } else {
          switch (rt.frequency) {
            case 'daily':
              nextDate = addDays(nextDate, 1);
              break;
            case 'weekly':
              nextDate = addWeeks(nextDate, 1);
              break;
            case 'monthly':
              nextDate = addMonths(nextDate, 1);
              break;
            case 'yearly':
              nextDate = addYears(nextDate, 1);
              break;
          }
        }

        while (isBefore(nextDate, today) || isToday(nextDate)) {
          const newTransactionDoc = doc(transactionsCollRef);
          batch.set(newTransactionDoc, {
            id: newTransactionDoc.id,
            date: nextDate.toISOString(),
            description: `(Recurring) ${rt.description}`,
            amount: rt.amount,
            type: rt.type,
            category: rt.category,
            categoryId: rt.categoryId ?? undefined,
          });
          transactionsAdded = true;

          lastAdded = nextDate;

          switch (rt.frequency) {
            case 'daily':
              nextDate = addDays(nextDate, 1);
              break;
            case 'weekly':
              nextDate = addWeeks(nextDate, 1);
              break;
            case 'monthly':
              nextDate = addMonths(nextDate, 1);
              break;
            case 'yearly':
              nextDate = addYears(nextDate, 1);
              break;
          }
        }

        if (lastAdded && (!rt.lastAddedDate || lastAdded.getTime() !== parseISO(rt.lastAddedDate).getTime())) {
          const recurringDocToUpdate = doc(recurringCollRef, rt.id);
          batch.update(recurringDocToUpdate, { lastAddedDate: lastAdded.toISOString() });
        }
      } catch (e) {
        console.error(`Error processing recurring transaction ID ${rt.id} with date ${rt.startDate}:`, e);
      }
    }

    try {
      if (transactionsAdded) {
        await batch.commit();
      }
    } catch (e) {
      console.error('Error processing recurring transactions batch: ', e);
    }
  }, [user, recurringTransactions, getCollectionRef]);

  useEffect(() => {
    if (user && !loading && recurringTransactions.length > 0) {
      processRecurringTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurringTransactions, loading]);

  // ---------- Sync user collections ----------

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setAllTransactions([]);
      setCategories([]);
      setBudgets([]);
      setRecurringTransactions([]);
      setGoals([]);
      return;
    }

    setLoading(true);

    const collectionsToSync = ['categories', 'budgets', 'recurringTransactions', 'goals', 'transactions'] as const;

    const unsubscribers = collectionsToSync.map((name) => {
      const collRef = getCollectionRef(name);
      if (!collRef) return () => {};

      const q = name === 'transactions' ? query(collRef, orderBy('date', 'desc')) : query(collRef);

      return onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }));
          switch (name) {
            case 'transactions':
              setAllTransactions(data as Transaction[]);
              break;
            case 'categories':
              setCategories(data as Category[]);
              break;
            case 'budgets':
              setBudgets(data as Budget[]);
              break;
            case 'recurringTransactions':
              setRecurringTransactions(data as RecurringTransaction[]);
              break;
            case 'goals':
              setGoals(data as Goal[]);
              break;
          }
          setLoading(false);
        },
        (error) => {
          console.error(`Error fetching ${name}:`, error);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [user, getCollectionRef]);

  // ---------- Category ID migration for legacy transactions ----------

  useEffect(() => {
    if (!user || loading || categories.length === 0 || allTransactions.length === 0) return;

    const transactionsNeedingCategoryId = allTransactions.filter(
      (t) => !t.categoryId && t.category
    );
    if (transactionsNeedingCategoryId.length === 0) return;

    const run = async () => {
      const collRef = getCollectionRef('transactions');
      if (!collRef) return;

      const batch = writeBatch(db);
      let updatedCount = 0;

      // Limit per run to avoid huge batches
      for (const t of transactionsNeedingCategoryId.slice(0, 100)) {
        const matched = findCategoryByPath(t.category, categories);
        if (matched) {
          const txRef = doc(collRef, t.id);
          batch.update(txRef, { categoryId: matched.id });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        await batch.commit();
        console.log(`Updated ${updatedCount} transactions with categoryId`);
      }
    };

    run().catch((e) => console.error('Error migrating categoryId for transactions:', e));
  }, [user, loading, categories, allTransactions, getCollectionRef]);

  const processedGoals = useMemo(() => {
    return goals.map(goal => {
      if (!goal.linkedCategoryId) {
        // Manual goal – keep savedAmount as stored
        return { ...goal, autoTrackingActive: false, contributingTransactions: [], autoSavedAmount: goal.savedAmount };
      }
  
      const category = findCategoryByIdRecursive(goal.linkedCategoryId, categories);
      if (!category) {
        // Linked to a category that no longer exists
        return { ...goal, autoTrackingActive: false, contributingTransactions: [], autoSavedAmount: goal.savedAmount };
      }
  
      const { ids: subtreeIds, names: subtreeNames } = getCategorySubtreeIdsAndNames(category);
      const contributionStartDate = goal.contributionStartDate
        ? new Date(goal.contributionStartDate)
        : new Date(0);
  
      const contributions = allTransactions.filter(t => {
        if (t.type !== "expense") return false;
  
        const tDate = new Date(t.date);
        if (tDate < contributionStartDate) return false;
  
        // 1) If you later add t.categoryId, use it first
        const matchesById =
          t.categoryId &&
          subtreeIds.includes(t.categoryId as string);
  
        // 2) Fallback: match by category name exactly
        const matchesByName = subtreeNames.includes(t.category);
  
        // 3) Extra forgiving: if you ever stored full paths like "Parent > Child",
        // treat a transaction as matching if it ends with "> Name" or equals Name
        const matchesByPath =
          !matchesById &&
          !matchesByName &&
          typeof t.category === "string" &&
          subtreeNames.some(name =>
            t.category === name ||
            t.category.endsWith(`> ${name}`)
          );
  
        return !!(matchesById || matchesByName || matchesByPath);
      });
  
      const autoSavedAmount = contributions.reduce((sum, t) => sum + t.amount, 0);
  
      return {
        ...goal,
        savedAmount: autoSavedAmount,
        autoTrackingActive: true,
        autoSavedAmount: autoSavedAmount,
        contributingTransactions: contributions,
        contributionLedger: contributions.map(t => ({
          transactionId: t.id,
          date: t.date,
          amount: t.amount,
          description: t.description,
          category: t.category,
        })),
      };
    });
  }, [
    goals,
    allTransactions,
    categories,
  ]);
  

  // ---------- Budgets: use categoryId tree instead of names ----------

  const getBudgetDetails = useCallback(
    (forDate: Date = new Date()) => {
      return budgets.map((budget) => {
        const result = findCategoryWithPathById(budget.categoryId, categories);
        let categoryName = 'Unknown Category';
        let allCategoryIdsForBudget: string[] = [];

        if (result) {
          categoryName = result.path.map((c) => c.name).join(' > ');
          allCategoryIdsForBudget = collectSubCategoryIds(result.category);
        }

        const spent = allTransactions
          .filter((t) => {
            if (t.type !== 'expense') return false;
            
            // This is the part that needs normalization.
            // A transaction's `category` field can be "Parent > Child".
            // A budget might be on "Parent". We need to check if the transaction
            // belongs under that parent tree.
            if (!t.categoryId || !allCategoryIdsForBudget.includes(t.categoryId)) {
                return false;
            }

            const transactionDate = new Date(t.date);
            const isMonthly =
              budget.period === 'monthly' &&
              transactionDate.getMonth() === forDate.getMonth() &&
              transactionDate.getFullYear() === forDate.getFullYear();
            const isYearly =
              budget.period === 'yearly' && transactionDate.getFullYear() === forDate.getFullYear();

            return isMonthly || isYearly;
          })
          .reduce((sum, t) => sum + t.amount, 0);

        const remaining = budget.amount - spent;
        const progress = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        return {
          ...budget,
          categoryName,
          spent,
          remaining,
          progress,
        };
      });
    },
    [budgets, allTransactions, categories]
  );

  // ---------- CRUD helpers ----------

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    const collRef = getCollectionRef('transactions');
    if (!collRef) return;
    const newDocRef = doc(collRef);
    
    await setDoc(newDocRef, {
      ...transaction,
      id: newDocRef.id,
    });
  };

  const updateTransaction = async (id: string, values: Partial<Omit<Transaction, 'id'>>) => {
    const collRef = getCollectionRef('transactions');
    if (!collRef) return;
    const docRef = doc(collRef, id);
    await setDoc(docRef, values, { merge: true });
  };

  const deleteTransaction = async (id: string) => {
    const collRef = getCollectionRef('transactions');
    if (!collRef) return;
    const docRef = doc(collRef, id);
    await deleteDoc(docRef);
  };

  const addCategory = async (category: Omit<Category, 'id'>): Promise<Category> => {
    const collRef = getCollectionRef('categories');
    if (!collRef) throw new Error("User not authenticated");
    const newDocRef = doc(collRef);
    const newCategory = { ...category, id: newDocRef.id };
    await setDoc(newDocRef, newCategory);
    return newCategory;
  };

  // Auto-update category *path string* for all transactions that reference this categoryId
  const updateCategory = async (id: string, _oldName: string, newName: string) => {
    const categoriesCollRef = getCollectionRef('categories');
    if (!categoriesCollRef) return;

    const categoryDocRef = doc(categoriesCollRef, id);
    const categorySnap = await getDoc(categoryDocRef);
    if (!categorySnap.exists()) return;

    const batch = writeBatch(db);

    // Update category document
    batch.update(categoryDocRef, { name: newName });

    // Recompute path for all affected transactions
    const transactionsCollRef = getCollectionRef('transactions');
    if (transactionsCollRef) {
      const q = query(transactionsCollRef, where('categoryId', '==', id));
      const querySnapshot = await getDocs(q);
      const updatedLabel = buildCategoryPathLabel(id, categories) ?? newName;
      querySnapshot.forEach((transactionDoc) => {
        batch.update(transactionDoc.ref, { category: updatedLabel });
      });
    }

    await batch.commit();
  };

  const deleteCategory = async (id: string) => {
    const collRef = getCollectionRef('categories');
    if (!collRef) return;
    const docRef = doc(collRef, id);
    await deleteDoc(docRef);
  };

  const addSubCategory = async (
    parentId: string,
    subCategory: Omit<SubCategory, 'id'>,
    parentPath: string[] = []
  ): Promise<SubCategory> => {
    const collRef = getCollectionRef('categories');
    if (!collRef) throw new Error("User not authenticated");
    const docRef = doc(collRef, parentId);
    const newId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSubCategory = { ...subCategory, id: newId, subCategories: [] };

    const parentDoc = await getDoc(docRef);
    if (parentDoc.exists()) {
      let data = parentDoc.data();

      const addNested = (items: SubCategory[], path: string[]): SubCategory[] => {
        if (path.length === 0) {
          return [...(items || []), newSubCategory];
        }
        const [currentId, ...restPath] = path;
        return items.map((item) => {
          if (item.id === currentId) {
            return { ...item, subCategories: addNested(item.subCategories || [], restPath) };
          }
          return item;
        });
      };

      const targetPath = parentPath[0] === parentId ? parentPath.slice(1) : parentPath;

      if (targetPath.length > 0) {
        data.subCategories = addNested(data.subCategories || [], targetPath);
      } else {
        data.subCategories = [...(data.subCategories || []), newSubCategory];
      }
      await setDoc(docRef, data, { merge: true });
    }
    return newSubCategory;
  };

  const updateSubCategory = async (
    categoryId: string,
    subCategoryId: string,
    _oldName: string,
    newName: string,
    parentPath: string[] = []
  ) => {
    const categoriesCollRef = getCollectionRef('categories');
    if (!categoriesCollRef) return;
    const batch = writeBatch(db);

    const categoryDocRef = doc(categoriesCollRef, categoryId);
    const parentDoc = await getDoc(categoryDocRef);
    if (parentDoc.exists()) {
      let subCategories = parentDoc.data().subCategories || [];

      const updateNested = (items: SubCategory[], path: string[]): SubCategory[] => {
        const [currentId, ...restPath] = path;
        if (restPath.length === 0) {
          return items.map((item) => (item.id === currentId ? { ...item, name: newName } : item));
        }
        return items.map((item) => {
          if (item.id === currentId) {
            return { ...item, subCategories: updateNested(item.subCategories || [], restPath) };
          }
          return item;
        });
      };

      const fullPath = [...parentPath, subCategoryId];
      const updatedSubCategories = updateNested(subCategories, fullPath);
      batch.update(categoryDocRef, { subCategories: updatedSubCategories });
    }

    // Update all transactions that reference this subCategoryId
    const transactionsCollRef = getCollectionRef('transactions');
    if (transactionsCollRef) {
      const q = query(transactionsCollRef, where('categoryId', '==', subCategoryId));
      const querySnapshot = await getDocs(q);
      const updatedLabel = buildCategoryPathLabel(subCategoryId, categories) ?? newName;

      querySnapshot.forEach((transactionDoc) => {
        batch.update(transactionDoc.ref, { category: updatedLabel });
      });
    }

    await batch.commit();
  };

  const deleteSubCategory = async (categoryId: string, subCategoryId: string, parentPath: string[] = []) => {
    const collRef = getCollectionRef('categories');
    if (!collRef) return;
    const docRef = doc(collRef, categoryId);
    const parentDoc = await getDoc(docRef);
    if (parentDoc.exists()) {
      let subCategories = parentDoc.data().subCategories || [];

      const deleteNested = (items: SubCategory[], path: string[]): SubCategory[] => {
        const [currentId, ...restPath] = path;
        if (restPath.length === 0) {
          return items.filter((item) => item.id !== currentId);
        }
        return items.map((item) => {
          if (item.id === currentId) {
            return { ...item, subCategories: deleteNested(item.subCategories || [], restPath) };
          }
          return item;
        });
      };

      const fullPath = [...parentPath, subCategoryId];
      const updatedSubCategories = deleteNested(subCategories, fullPath);
      await setDoc(docRef, { subCategories: updatedSubCategories }, { merge: true });
    }
  };

  const addBudget = async (budget: Omit<Budget, 'id'>) => {
    const collRef = getCollectionRef('budgets');
    if (!collRef) return;
    const newDocRef = doc(collRef);
    await setDoc(newDocRef, { ...budget, id: newDocRef.id });
  };

  const updateBudget = async (id: string, values: Partial<Omit<Budget, 'id'>>) => {
    const collRef = getCollectionRef('budgets');
    if (!collRef) return;
    const docRef = doc(collRef, id);
    await setDoc(docRef, values, { merge: true });
  };

  const deleteBudget = async (id: string) => {
    const collRef = getCollectionRef('budgets');
    if (!collRef) return;
    const docRef = doc(collRef, id);
    await deleteDoc(docRef);
  };

  const toggleFavoriteBudget = async (id: string) => {
    const collRef = getCollectionRef('budgets');
    if (!collRef) return;
    const docRef = doc(collRef, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await setDoc(docRef, { isFavorite: !docSnap.data().isFavorite }, { merge: true });
    }
  };

  const addRecurringTransaction = async (transaction: Omit<RecurringTransaction, 'id'>) => {
    const collRef = getCollectionRef('recurringTransactions');
    if (!collRef) return;
    const newDocRef = doc(collRef);
    await setDoc(newDocRef, { ...transaction, id: newDocRef.id, lastAddedDate: null });
  };

  const updateRecurringTransaction = async (
    id: string,
    values: Partial<Omit<RecurringTransaction, 'id'>>
  ) => {
    const collRef = getCollectionRef('recurringTransactions');
    if (!collRef) return;
    const docRef = doc(collRef, id);
    await setDoc(docRef, values, { merge: true });
  };

  const deleteRecurringTransaction = async (id: string) => {
    const collRef = getCollectionRef('recurringTransactions');
    if (!collRef) return;
    const docRef = doc(collRef, id);
    await deleteDoc(docRef);
  };

  const addGoal = async (goal: Omit<Goal, 'id'>) => {
    const collRef = getCollectionRef('goals');
    if (!collRef) return;
    const newDocRef = doc(collRef);
    await setDoc(newDocRef, { ...goal, id: newDocRef.id });
  };

  const updateGoal = async (id: string, values: Partial<Omit<Goal, 'id'>>) => {
    const collRef = getCollectionRef('goals');
    if (!collRef) return;
    const docRef = doc(collRef, id);
    await setDoc(docRef, values, { merge: true });
  };

  const deleteGoal = async (id: string) => {
    const collRef = getCollectionRef('goals');
    if (!collRef) return;
    const docRef = doc(collRef, id);
    await deleteDoc(docRef);
  };

  const addContributionToGoal = async (goalId: string, amount: number) => {
    const collRef = getCollectionRef('goals');
    if (!collRef) return;
    const goalRef = doc(collRef, goalId);
    const goalDoc = await getDoc(goalRef);
    if (goalDoc.exists()) {
      const goal = goalDoc.data() as Goal;
      const newSavedAmount = (goal.savedAmount ?? 0) + amount;
      await updateGoal(goalId, { savedAmount: newSavedAmount });
    }
  };

  const clearCollection = async (collectionName: string, constraints: QueryConstraint[] = []) => {
    const collRef = getCollectionRef(collectionName);
    if (!collRef) return;
    const q = query(collRef, ...constraints);
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  };

  const clearTransactions = async () => {
    await clearCollection('transactions');
  };

  const clearTransactionsByDateRange = async (startDate: Date, endDate: Date) => {
    const constraints: QueryConstraint[] = [
      where('date', '>=', startDate.toISOString()),
      where('date', '<=', endDate.toISOString()),
    ];
    await clearCollection('transactions', constraints);
  };

  const clearAllData = async () => {
    await Promise.all([
      clearCollection('transactions'),
      clearCollection('categories'),
      clearCollection('budgets'),
      clearCollection('recurringTransactions'),
      clearCollection('goals'),
    ]);
  };

  const importCategories = async (importedData: { name: string; type: 'income' | 'expense'; parent_name: string }[]) => {
    const collRef = getCollectionRef('categories');
    if (!collRef) throw new Error('User not authenticated');

    const existingCats = [...categories];

    const findCategoryByNameLoose = (
      name: string,
      cats: (Category | SubCategory)[]
    ): Category | SubCategory | undefined => {
      for (const cat of cats) {
        if (cat.name.toLowerCase() === name.toLowerCase()) return cat;
        if (cat.subCategories) {
          const found = findCategoryByNameLoose(name, cat.subCategories);
          if (found) return found;
        }
      }
      return undefined;
    };

    const batch = writeBatch(db);

    // First pass: main categories
    const mainCategoriesToCreate = importedData.filter(
      (item) => !item.parent_name && !findCategoryByNameLoose(item.name, existingCats)
    );

    mainCategoriesToCreate.forEach((item) => {
      const newDocRef = doc(collRef);
      batch.set(newDocRef, {
        id: newDocRef.id,
        name: item.name,
        type: item.type,
        icon: 'Sparkles',
        subCategories: [],
      });
      existingCats.push({ id: newDocRef.id, name: item.name, type: item.type, subCategories: [] } as any);
    });

    await batch.commit();

    // Second pass: subcategories
    const subCategoriesToCreate = importedData.filter((item) => item.parent_name);
    for (const item of subCategoriesToCreate) {
      if (!findCategoryByNameLoose(item.name, existingCats)) {
        const parent = findCategoryByNameLoose(item.parent_name, existingCats) as Category | undefined;
        if (parent && parent.type) {
          const newSub: Omit<SubCategory, 'id'> = { name: item.name, icon: 'Sparkles' } as any;
          await addSubCategory((parent as any).id, newSub);
        }
      }
    }
  };

  const value: UserDataContextType = {
    allTransactions,
    categories,
    budgets,
    recurringTransactions,
    goals: processedGoals,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    addSubCategory,
    updateCategory,
    deleteCategory,
    updateSubCategory,
    deleteSubCategory,
    addBudget,
    updateBudget,
    deleteBudget,
    toggleFavoriteBudget,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    getBudgetDetails,
    addGoal,
    updateGoal,
    deleteGoal,
    addContributionToGoal,
    clearTransactions,
    clearAllData,
    clearTransactionsByDateRange,
    importCategories,
  };

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
};

export const useUserData = () => {
  const context = useContext(UserDataContext);
  if (context === undefined) {
    throw new Error('useUserData must be used within a UserDataProvider');
  }
  return context;
};
