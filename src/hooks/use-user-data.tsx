

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import { chunkArray } from '@/lib/batching';
import { getYear } from 'date-fns';
import {
  prepareTransactionImport,
  type TransactionImportSummary,
} from '@/lib/transaction-import';

interface UserDataContextType {
  allTransactions: Transaction[];
  transactions: Transaction[]; // Year-scoped transactions
  categories: Category[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
  goals: ProcessedGoal[];
  startingBalance: number;
  loading: boolean;
  recurringSync: {
    status: 'idle' | 'syncing' | 'success' | 'error';
    message?: string;
    lastSyncedAt?: Date;
  };
  syncRecurringTransactions: () => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  importTransactions: (transactions: Omit<Transaction, 'id'>[]) => Promise<TransactionImportSummary>;
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
  getBudgetDetails: (params: {
    activeBudgets: Budget[];
    comparisonBudgets?: Budget[];
    transactions: Transaction[];
    categories: Category[];
    forDate: Date;
    comparisonYear?: number;
  }) => any[];
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

const findCategoryByPath = (
  path: string,
  cats: Category[],
  type?: Transaction['type']
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

  const rootCategories = type ? cats.filter((category) => category.type === type) : cats;
  const exactPathMatch = search(rootCategories, 0);
  if (exactPathMatch) return exactPathMatch;

  const targetLeaf = parts.at(-1)?.toLocaleLowerCase();
  const findLeaf = (items: (Category | SubCategory)[]): Category | SubCategory | undefined => {
    for (const item of items) {
      if (item.name.toLocaleLowerCase() === targetLeaf) return item;
      const nested = item.subCategories ? findLeaf(item.subCategories) : undefined;
      if (nested) return nested;
    }
    return undefined;
  };
  return findLeaf(rootCategories);
};

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

const buildCategoryPathLabel = (id: string, categories: Category[]): string | undefined => {
  const result = findCategoryWithPathById(id, categories);
  if (!result) return undefined;
  return result.path.map((c) => c.name).join(' > ');
};

export const UserDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, activeYear, firstYear } = useAuth();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [startingBalance, setStartingBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recurringSync, setRecurringSync] = useState<UserDataContextType['recurringSync']>({
    status: 'idle',
  });
  const recurrenceProcessingRef = useRef(false);
  const categoryMigrationRef = useRef(false);

  const transactions = useMemo(
    () => allTransactions.filter((transaction) => {
      const date = new Date(transaction.date);
      return !Number.isNaN(date.getTime()) && getYear(date) === activeYear;
    }),
    [allTransactions, activeYear]
  );

  const getCollectionRef = useCallback(
    (collectionName: string) => {
      if (!user) return null;
      return collection(db, 'users', user.uid, collectionName);
    },
    [user]
  );
  
  // One-time migration effect for budgets without a year
  useEffect(() => {
    if (loading || !user || !budgets.length || !allTransactions.length) return;

    const migrateBudgets = async () => {
        const budgetsToMigrate = budgets.filter(b => typeof b.year !== 'number');

        if (budgetsToMigrate.length === 0) return;
        
        console.log(`Found ${budgetsToMigrate.length} legacy budgets to migrate.`);

        const budgetsCollRef = getCollectionRef('budgets');
        if (!budgetsCollRef) return;

        const batch = writeBatch(db);

        for (const budget of budgetsToMigrate) {
            const budgetCategory = findCategoryByIdRecursive(budget.categoryId, categories);
            const budgetCategoryTree = budgetCategory
              ? getCategorySubtreeIdsAndNames(budgetCategory)
              : { ids: [], names: [] };
            
            const budgetTxs = allTransactions
                .filter((transaction) => {
                  if (transaction.type !== 'expense') return false;
                  if (transaction.categoryId) {
                    return budgetCategoryTree.ids.includes(transaction.categoryId);
                  }
                  return budgetCategoryTree.names.includes(transaction.category);
                })
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            const inferredYear = budgetTxs.length > 0 ? getYear(new Date(budgetTxs[0].date)) : firstYear;

            const budgetRef = doc(budgetsCollRef, budget.id);
            batch.update(budgetRef, { year: inferredYear });
        }

        try {
            await batch.commit();
            console.log(`Successfully migrated ${budgetsToMigrate.length} budgets.`);
        } catch (error) {
            console.error("Budget migration failed:", error);
        }
    };

    migrateBudgets();
    // We only want this to run once after the initial data load, so we disable the exhaustive-deps rule.
    // The check for budgetsToMigrate.length prevents it from running multiple times.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);


  const processRecurringTransactions = useCallback(async () => {
    const systemYear = new Date().getFullYear();
    if (activeYear !== systemYear) {
      setRecurringSync({ status: 'error', message: 'Switch to the current year to sync schedules.' });
      return;
    }
    if (!user) throw new Error('User not authenticated');
    if (recurrenceProcessingRef.current) return;

    if (recurringTransactions.length === 0) {
      setRecurringSync({
        status: 'success',
        message: 'No recurring schedules need processing.',
        lastSyncedAt: new Date(),
      });
      return;
    }

    recurrenceProcessingRef.current = true;
    setRecurringSync({ status: 'syncing', message: 'Checking scheduled transactions…' });
    try {
      let totalUpserted = 0;
      let hasMore = false;
      for (let batchNumber = 0; batchNumber < 3; batchNumber += 1) {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/recurring/process', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const result = (await response.json()) as { hasMore?: boolean; upserted?: number; error?: string };
        if (!response.ok) throw new Error(result.error ?? 'Recurring transaction processing failed');
        totalUpserted += result.upserted ?? 0;
        hasMore = Boolean(result.hasMore);
        if (!result.hasMore) break;
      }
      setRecurringSync({
        status: 'success',
        message: hasMore
          ? `${totalUpserted} scheduled transactions added. More remain; select Sync now again.`
          : totalUpserted > 0
          ? `${totalUpserted} scheduled transaction${totalUpserted === 1 ? '' : 's'} added.`
          : 'Recurring transactions are up to date.',
        lastSyncedAt: new Date(),
      });
    } catch (error) {
      console.error('Error processing recurring transactions:', error);
      setRecurringSync({
        status: 'error',
        message: error instanceof Error ? error.message : 'Recurring sync failed.',
      });
      throw error;
    } finally {
      recurrenceProcessingRef.current = false;
    }
  }, [user, recurringTransactions.length, activeYear]);

  useEffect(() => {
    if (user && !loading && recurringTransactions.length > 0) {
      void processRecurringTransactions().catch(() => undefined);
    }
  }, [recurringTransactions, loading, processRecurringTransactions, user]);
  
  useEffect(() => {
    if (!user) {
      setLoading(false);
      setAllTransactions([]);
      setCategories([]);
      setBudgets([]);
      setRecurringTransactions([]);
      setGoals([]);
      setStartingBalance(0);
      return;
    }

    setLoading(true);

    const pendingSources = new Set([
      'settings',
      'categories',
      'budgets',
      'recurringTransactions',
      'goals',
      'transactions',
    ]);
    const markReady = (source: string) => {
      pendingSources.delete(source);
      if (pendingSources.size === 0) setLoading(false);
    };

    const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'main');
    const unsubSettings = onSnapshot(
      settingsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setStartingBalance(docSnap.data().startingBalance || 0);
        }
        markReady('settings');
      },
      (error) => {
        console.error('Error fetching settings:', error);
        markReady('settings');
      }
    );

    const collectionsToSync = ['categories', 'budgets', 'recurringTransactions', 'goals'] as const;

    const unsubscribers = collectionsToSync.map((name) => {
      const collRef = getCollectionRef(name);
      if (!collRef) return () => {};

      return onSnapshot(
        query(collRef),
        (snapshot) => {
          const data = snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }));
          switch (name) {
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
          markReady(name);
        },
        (error) => {
          console.error(`Error fetching ${name}:`, error);
          markReady(name);
        }
      );
    });

    const allTransactionsCollRef = getCollectionRef('transactions');
    if (allTransactionsCollRef) {
      const unsubAllTransactions = onSnapshot(
        query(allTransactionsCollRef, orderBy('date', 'desc')),
        (snapshot) => {
          setAllTransactions(
            snapshot.docs.map((document) => ({
              ...document.data(),
              id: document.id,
            })) as Transaction[]
          );
          markReady('transactions');
        },
        (error) => {
          console.error('Error fetching all transactions:', error);
          markReady('transactions');
        }
      );
      unsubscribers.push(unsubAllTransactions);
    } else {
      markReady('transactions');
    }


    return () => {
      unsubSettings();
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [user, getCollectionRef]);

  useEffect(() => {
    if (
      !user ||
      loading ||
      categories.length === 0 ||
      categoryMigrationRef.current
    ) return;

    const run = async () => {
      const collRef = getCollectionRef('transactions');
      if (!collRef) return;
      categoryMigrationRef.current = true;

      const settingsRef = doc(db, 'users', user.uid, 'settings', 'main');
      const settingsSnapshot = await getDoc(settingsRef);
      if ((settingsSnapshot.data()?.dataSchemaVersion ?? 0) >= 2) return;

      const transactionsNeedingCategoryId = allTransactions.filter(
        (transaction) => !transaction.categoryId && transaction.category
      );
      let updatedCount = 0;

      for (const transactionChunk of chunkArray(transactionsNeedingCategoryId, 450)) {
        const batch = writeBatch(db);
        let chunkWrites = 0;
        for (const transaction of transactionChunk) {
          const matched = findCategoryByPath(
            transaction.category,
            categories,
            transaction.type
          );
          if (matched) {
            batch.update(doc(collRef, transaction.id), { categoryId: matched.id });
            updatedCount += 1;
            chunkWrites += 1;
          }
        }
        if (chunkWrites > 0) await batch.commit();
      }

      await setDoc(settingsRef, { dataSchemaVersion: 2 }, { merge: true });
      console.info(`Category migration complete: ${updatedCount} transactions updated.`);
    };

    run().catch((error) => {
      categoryMigrationRef.current = false;
      console.error('Error migrating categoryId for transactions:', error);
    });
  }, [user, loading, categories, allTransactions, getCollectionRef]);

  const processedGoals = useMemo((): ProcessedGoal[] => {
    if (loading) {
        return goals.map(g => ({ ...g, autoTrackingActive: false, autoSavedAmount: 0, contributingTransactions: [] }));
    }
  
    return goals.map(goal => {
      if (!goal.linkedCategoryId) {
        return { ...goal, autoTrackingActive: false, autoSavedAmount: 0, contributingTransactions: [] };
      }
  
      const category = findCategoryByIdRecursive(goal.linkedCategoryId, categories);
      if (!category) {
        return { ...goal, autoTrackingActive: false, autoSavedAmount: 0, contributingTransactions: [] };
      }
  
      const { ids: subtreeIds, names: subtreeNames } = getCategorySubtreeIdsAndNames(category);
      const contributionStartDate = goal.contributionStartDate
        ? new Date(goal.contributionStartDate)
        : new Date(0);
  
      const contributions = allTransactions.filter(t => {
        if (t.type !== "expense") return false;
  
        const tDate = new Date(t.date);
        if (tDate < contributionStartDate) return false;
  
        const matchesById =
          t.categoryId &&
          subtreeIds.includes(t.categoryId as string);
  
        const matchesByName = subtreeNames.includes(t.category);
  
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
        autoSavedAmount,
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
    loading
  ]);

  const getBudgetDetails = useCallback(
    ({
      activeBudgets,
      comparisonBudgets = [],
      transactions,
      categories,
      forDate,
      comparisonYear,
    }: {
      activeBudgets: Budget[];
      comparisonBudgets?: Budget[];
      transactions: Transaction[];
      categories: Category[];
      forDate: Date;
      comparisonYear?: number;
    }) => {
      const reportYear = getYear(forDate);

      const findFirstTransactionYearForBudget = (
        budget: Budget,
        allTx: Transaction[],
        allCategoryIds: string[],
        allCategoryNames: string[]
      ) => {
        const budgetTxs = allTx
          .filter(
            (t) =>
              t.type === 'expense' &&
              (t.categoryId
                ? allCategoryIds.includes(t.categoryId)
                : allCategoryNames.includes(t.category))
          )
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return budgetTxs.length > 0
          ? getYear(new Date(budgetTxs[0].date))
          : null;
      };

      const relevantBudgets = activeBudgets.filter((budget) => {
        let effectiveYear = budget.year;
        if (typeof effectiveYear !== 'number') {
            const budgetCategoryTree = getCategorySubtreeIdsAndNames(
              findCategoryByIdRecursive(budget.categoryId, categories) || {} as Category
            );
            effectiveYear = findFirstTransactionYearForBudget(
              budget,
              transactions,
              budgetCategoryTree.ids,
              budgetCategoryTree.names
            ) ?? firstYear;
        }
        return effectiveYear === reportYear;
      });

      if (relevantBudgets.length === 0) {
        return [];
      }

      const normalizeCategoryName = (name: string): string => {
        if (!name) return '';
        return name.split(">").map(n => n.trim()).pop()!;
      };
      
      const calculateSpending = (
        budget: Budget,
        allCategoryIdsForBudget: string[],
        allCategoryNamesForBudget: string[],
        currentForDate: Date,
        yearToFilter: number
      ) => {
        return transactions
          .filter((t) => {
            const transactionYear = getYear(new Date(t.date));
            if (transactionYear !== yearToFilter) return false;
            
            if (t.type !== 'expense') return false;
            
            const categoryMatches = t.categoryId
              ? allCategoryIdsForBudget.includes(t.categoryId)
              : allCategoryNamesForBudget.includes(normalizeCategoryName(t.category));
            if (!categoryMatches) {
                return false;
            }

            const transactionDate = new Date(t.date);

            if (budget.period === 'monthly') {
                return transactionDate.getMonth() === currentForDate.getMonth();
            }
            
            if (budget.period === 'yearly') {
                return true;
            }

            return false;
          })
          .reduce((sum, t) => sum + t.amount, 0);
      };

      return relevantBudgets.map((budget) => {
        const result = findCategoryWithPathById(budget.categoryId, categories);
        let categoryName = 'Unknown Category';
        let allCategoryIdsForBudget: string[] = [];
        let allCategoryNamesForBudget: string[] = [];

        if (result) {
          categoryName = result.path.map((c) => c.name).join(' > ');
          const categoryTree = getCategorySubtreeIdsAndNames(result.category);
          allCategoryIdsForBudget = categoryTree.ids;
          allCategoryNamesForBudget = categoryTree.names;
        }

        const spent = calculateSpending(
          budget,
          allCategoryIdsForBudget,
          allCategoryNamesForBudget,
          forDate,
          reportYear
        );

        const remaining = budget.amount - spent;
        const progress = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
        
        let deltas = null;
        if (comparisonYear && comparisonBudgets && comparisonBudgets.length > 0) {
            const comparisonBudget = comparisonBudgets.find(b => b.categoryId === budget.categoryId && b.period === budget.period);
            if (comparisonBudget) {
                const comparisonDate = new Date(comparisonYear, forDate.getMonth(), 1);
                const comparisonSpent = calculateSpending(
                  comparisonBudget,
                  allCategoryIdsForBudget,
                  allCategoryNamesForBudget,
                  comparisonDate,
                  comparisonYear
                );
                const comparisonRemaining = comparisonBudget.amount - comparisonSpent;

                deltas = {
                    amount: budget.amount - comparisonBudget.amount,
                    spent: spent - comparisonSpent,
                    remaining: remaining - comparisonRemaining,
                }
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
    },
    [firstYear]
  );

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    const collRef = getCollectionRef('transactions');
    if (!collRef) return;
    const newDocRef = doc(collRef);
    
    await setDoc(newDocRef, {
      ...transaction,
      id: newDocRef.id,
    });
  };

  const importTransactions = async (
    importedTransactions: Omit<Transaction, 'id'>[]
  ): Promise<TransactionImportSummary> => {
    const collRef = getCollectionRef('transactions');
    if (!collRef) throw new Error('User not authenticated');

    const prepared = prepareTransactionImport(importedTransactions, allTransactions);
    for (const transactionChunk of chunkArray(prepared.transactions, 450)) {
      const batch = writeBatch(db);
      transactionChunk.forEach((transaction) => {
        const newDocRef = doc(collRef);
        batch.set(newDocRef, { ...transaction, id: newDocRef.id });
      });
      await batch.commit();
    }

    return {
      imported: prepared.transactions.length,
      duplicates: prepared.duplicates,
    };
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

  const updateCategory = async (id: string, _oldName: string, newName: string) => {
    const categoriesCollRef = getCollectionRef('categories');
    if (!categoriesCollRef) return;

    const categoryDocRef = doc(categoriesCollRef, id);
    const categorySnap = await getDoc(categoryDocRef);
    if (!categorySnap.exists()) return;

    const batch = writeBatch(db);

    batch.update(categoryDocRef, { name: newName });

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
      const data = parentDoc.data();

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
      const subCategories = parentDoc.data().subCategories || [];

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
      const subCategories = parentDoc.data().subCategories || [];

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
    const chunks = chunkArray(snapshot.docs, 450);
    await Promise.all(chunks.map(async (docs) => {
      const batch = writeBatch(db);
      docs.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    }));
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
    transactions,
    categories,
    budgets,
    recurringTransactions,
    goals: processedGoals,
    startingBalance,
    loading,
    recurringSync,
    syncRecurringTransactions: processRecurringTransactions,
    addTransaction,
    importTransactions,
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
