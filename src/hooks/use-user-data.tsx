
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, doc, getDocs, onSnapshot, writeBatch, getDoc, setDoc, deleteDoc, query, orderBy, limit, startAfter, where, QueryConstraint, getCountFromServer } from 'firebase/firestore';
import type { Transaction, Category, SubCategory, Budget, RecurringTransaction, Goal } from '@/types';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase';
import { addDays, addWeeks, addMonths, addYears, isBefore, startOfDay, parseISO, isToday } from 'date-fns';

const TRANSACTIONS_PAGE_SIZE = 25;

interface UserDataContextType {
  allTransactions: Transaction[];
  paginatedTransactions: Transaction[];
  totalPaginatedTransactions: number;
  categories: Category[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
  goals: Goal[];
  loading: boolean;
  hasMore: boolean;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (id: string, values: Partial<Omit<Transaction, 'id'>>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  addSubCategory: (parentId: string, subCategory: Omit<SubCategory, 'id'>, parentPath?: string[]) => Promise<void>;
  updateCategory: (id: string, newName: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateSubCategory: (categoryId: string, subCategoryId: string, newName: string, parentPath?: string[]) => Promise<void>;
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
  fetchPaginatedTransactions: (reset: boolean, filters?: any) => void;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export const UserDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [paginatedTransactions, setPaginatedTransactions] = useState<Transaction[]>([]);
  const [totalPaginatedTransactions, setTotalPaginatedTransactions] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination state
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const getCollectionRef = useCallback((collectionName: string) => {
    if (!user) return null;
    return collection(db, 'users', user.uid, collectionName);
  }, [user]);

  const fetchPaginatedTransactions = useCallback(async (reset: boolean, filters: any = {}) => {
      const collRef = getCollectionRef('transactions');
      if (!collRef) return;
  
      setLoading(true);
      if (reset) {
          setLastVisible(null);
          setPaginatedTransactions([]);
      }
  
      const queryConstraints: QueryConstraint[] = [];
      
      // Firestore limitation: You can only perform range filters on a single field.
      // We will prioritize date for range filtering. Other filters will be equality checks.
      if (filters.dateRange?.from) queryConstraints.push(where("date", ">=", filters.dateRange.from.toISOString()));
      if (filters.dateRange?.to) queryConstraints.push(where("date", "<=", filters.dateRange.to.toISOString()));

      // Equality check for category
      if (filters.category && filters.category !== 'all') queryConstraints.push(where("category", "==", filters.category));

      // For description, we'll have to rely on client-side filtering after the query for a "contains" search,
      // as Firestore doesn't support it efficiently on text fields combined with other filters.
      // The >= and <= trick only works for prefix searches and can cause index issues with other range filters.
      
      // We can do amount filtering if no date range is selected.
      if (!filters.dateRange) {
        if (filters.minAmount) queryConstraints.push(where("amount", ">=", filters.minAmount));
        if (filters.maxAmount) queryConstraints.push(where("amount", "<=", filters.maxAmount));
      }

      // Always order by date
      queryConstraints.push(orderBy("date", "desc"));
      
      let baseQuery = query(collRef, ...queryConstraints);
      
      try {
        const totalCountSnapshot = await getCountFromServer(baseQuery);
        setTotalPaginatedTransactions(totalCountSnapshot.data().count);

        if (lastVisible && !reset) {
          baseQuery = query(baseQuery, startAfter(lastVisible));
        }
        
        const finalQuery = query(baseQuery, limit(TRANSACTIONS_PAGE_SIZE));
      
        const documentSnapshots = await getDocs(finalQuery);
        let newTransactions = documentSnapshots.docs.map(doc => doc.data() as Transaction);

        // Client-side filtering for description 'contains'
        if (filters.description) {
            newTransactions = newTransactions.filter(t => 
                t.description.toLowerCase().includes(filters.description.toLowerCase())
            );
        }
    
        const lastDoc = documentSnapshots.docs[documentSnapshots.docs.length-1];
        setLastVisible(lastDoc);
        setHasMore(documentSnapshots.docs.length === TRANSACTIONS_PAGE_SIZE);

        setPaginatedTransactions(prev => reset ? newTransactions : [...prev, ...newTransactions]);

      } catch (error) {
        console.error("Error fetching paginated transactions:", error);
      } finally {
        setLoading(false);
      }
  }, [getCollectionRef, lastVisible]);

  const processRecurringTransactions = useCallback(async () => {
    if (!user || recurringTransactions.length === 0) return;
  
    const today = startOfDay(new Date());
    const batch = writeBatch(db);
    let transactionsAdded = false;
    const transactionsCollRef = getCollectionRef('transactions');
    const recurringCollRef = getCollectionRef('recurringTransactions');
  
    if (!transactionsCollRef || !recurringCollRef) return;
  
    for (const rt of recurringTransactions) {
      let lastProcessedDate = rt.lastAddedDate ? parseISO(rt.lastAddedDate) : startOfDay(parseISO(rt.startDate));
      
      if (isBefore(today, lastProcessedDate)) {
        continue;
      }

      if (isToday(lastProcessedDate) && rt.lastAddedDate) {
          continue;
      }
      
      let nextDate = lastProcessedDate;

       if (!rt.lastAddedDate) {
           if (isBefore(nextDate, today) || isToday(nextDate)) {
               const newTransactionDoc = doc(transactionsCollRef);
                 batch.set(newTransactionDoc, {
                    id: newTransactionDoc.id,
                    date: nextDate.toISOString(),
                    description: `(Recurring) ${rt.description}`,
                    amount: rt.amount,
                    type: rt.type,
                    category: rt.category
                 });
                 const recurringDocToUpdate = doc(recurringCollRef, rt.id);
                 batch.update(recurringDocToUpdate, { lastAddedDate: nextDate.toISOString() });
                 transactionsAdded = true;
           }
      }

      if (rt.lastAddedDate) {
         switch(rt.frequency) {
            case 'daily': nextDate = addDays(nextDate, 1); break;
            case 'weekly': nextDate = addWeeks(nextDate, 1); break;
            case 'monthly': nextDate = addMonths(nextDate, 1); break;
            case 'yearly': nextDate = addYears(nextDate, 1); break;
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
          category: rt.category
        });
        transactionsAdded = true;
  
        const recurringDocToUpdate = doc(recurringCollRef, rt.id);
        batch.update(recurringDocToUpdate, { lastAddedDate: nextDate.toISOString() });
  
        switch(rt.frequency) {
          case 'daily': nextDate = addDays(nextDate, 1); break;
          case 'weekly': nextDate = addWeeks(nextDate, 1); break;
          case 'monthly': nextDate = addMonths(nextDate, 1); break;
          case 'yearly': nextDate = addYears(nextDate, 1); break;
        }
      }
    }
  
    try {
        if(transactionsAdded){
            await batch.commit();
            fetchPaginatedTransactions(true, {}); // Refetch transactions if new ones were added.
        }
    } catch(e) {
        console.error("Error processing recurring transactions batch: ", e)
    }

  }, [user, recurringTransactions, getCollectionRef, fetchPaginatedTransactions]);
  
  useEffect(() => {
    if (user && !loading && recurringTransactions.length > 0) {
      processRecurringTransactions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, recurringTransactions]);


  useEffect(() => {
    if (!user) {
      setLoading(false);
      setAllTransactions([]);
      setPaginatedTransactions([]);
      setCategories([]);
      setBudgets([]);
      setRecurringTransactions([]);
      setGoals([]);
      return;
    }

    setLoading(true);
    
    const collectionsToSync = ['categories', 'budgets', 'recurringTransactions', 'goals', 'transactions'];
    const unsubscribers = collectionsToSync.map(name => {
      const collRef = getCollectionRef(name);
      if (!collRef) return () => {};
      
      const q = name === 'transactions' ? query(collRef, orderBy('date', 'desc')) : query(collRef);

      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        switch (name) {
          case 'transactions': setAllTransactions(data as Transaction[]); break;
          case 'categories': setCategories(data as Category[]); break;
          case 'budgets': setBudgets(data as Budget[]); break;
          case 'recurringTransactions': setRecurringTransactions(data as RecurringTransaction[]); break;
          case 'goals': setGoals(data as Goal[]); break;
        }
        if (name === 'transactions') setLoading(false);
      }, (error) => {
        console.error(`Error fetching ${name}:`, error);
        if (name === 'transactions') setLoading(false);
      });
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, getCollectionRef]);
  
  const getSubCategoryNames = useCallback((category: Category | SubCategory): string[] => {
      let names = [category.name];
      if (category.subCategories) {
          category.subCategories.forEach(sub => {
              names = [...names, ...getSubCategoryNames(sub)];
          });
      }
      return names;
  }, []);

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    const collRef = getCollectionRef('transactions');
    if (!collRef) return;
    const newDocRef = doc(collRef);
    await setDoc(newDocRef, { ...transaction, id: newDocRef.id });
  };
  
  const updateTransaction = async (id: string, values: Partial<Omit<Transaction, 'id'>>) => {
      const collRef = getCollectionRef('transactions');
      if (!collRef) return;
      const docRef = doc(collRef, id);
      await setDoc(docRef, values, { merge: true });
  }

  const deleteTransaction = async (id: string) => {
    const collRef = getCollectionRef('transactions');
    if (!collRef) return;
    const docRef = doc(collRef, id);
    await deleteDoc(docRef);
  };
  
  const addCategory = async (category: Omit<Category, 'id'>) => {
    const collRef = getCollectionRef('categories');
    if (!collRef) return;
    const newDocRef = doc(collRef);
    await setDoc(newDocRef, { ...category, id: newDocRef.id });
  };
  
  const updateCategory = async (id: string, newName: string) => {
    const collRef = getCollectionRef('categories');
    if (!collRef) return;
    const docRef = doc(collRef, id);
    await setDoc(docRef, { name: newName }, { merge: true });
  }

  const deleteCategory = async (id: string) => {
    const collRef = getCollectionRef('categories');
    if (!collRef) return;
    const docRef = doc(collRef, id);
    await deleteDoc(docRef);
  }

  const addSubCategory = async (parentId: string, subCategory: Omit<SubCategory, 'id'>, parentPath: string[] = []) => {
     const collRef = getCollectionRef('categories');
     if (!collRef) return;
     const docRef = doc(collRef, parentId);
     const newId = `sub_${Date.now()}`;
     const newSubCategory = { ...subCategory, id: newId, subCategories: [] };

     const parentDoc = await getDoc(docRef);
     if(parentDoc.exists()){
         let data = parentDoc.data();
         
         const addNested = (items: SubCategory[], path: string[]): SubCategory[] => {
             if (path.length === 0) {
                 return [...(items || []), newSubCategory];
             }
             const [currentId, ...restPath] = path;
             return items.map(item => {
                 if (item.id === currentId) {
                     return { ...item, subCategories: addNested(item.subCategories || [], restPath)};
                 }
                 return item;
             });
         };
         
         const targetPath = parentPath[0] === parentId ? parentPath.slice(1) : parentPath;

         if (targetPath.length > 0) {
            data.subCategories = addNested(data.subCategories || [], targetPath);
         } else {
            data.subCategories = [...(data.subCategories || []), newSubCategory]
         }
         await setDoc(docRef, data, { merge: true });
     }
  };
  
  const updateSubCategory = async (categoryId: string, subCategoryId: string, newName: string, parentPath: string[] = []) => {
      const collRef = getCollectionRef('categories');
      if (!collRef) return;
      const docRef = doc(collRef, categoryId);
      const parentDoc = await getDoc(docRef);
       if(parentDoc.exists()){
         let subCategories = parentDoc.data().subCategories || [];
         
         const updateNested = (items: SubCategory[], path: string[]): SubCategory[] => {
             const [currentId, ...restPath] = path;
             if (restPath.length === 0) {
                return items.map(item => item.id === currentId ? { ...item, name: newName } : item);
             }
             return items.map(item => {
                 if(item.id === currentId) {
                     return { ...item, subCategories: updateNested(item.subCategories || [], restPath) };
                 }
                 return item;
             });
         };
         const fullPath = [...parentPath, subCategoryId];
         const updatedSubCategories = updateNested(subCategories, fullPath);
         await setDoc(docRef, { subCategories: updatedSubCategories }, { merge: true });
     }
  }

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
                  return items.filter(item => item.id !== currentId);
              }
              return items.map(item => {
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
  }

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
    if(docSnap.exists()) {
        await setDoc(docRef, { isFavorite: !docSnap.data().isFavorite }, { merge: true });
    }
  };
  
  const addRecurringTransaction = async (transaction: Omit<RecurringTransaction, 'id'>) => {
    const collRef = getCollectionRef('recurringTransactions');
    if (!collRef) return;
    const newDocRef = doc(collRef);
    await setDoc(newDocRef, { ...transaction, id: newDocRef.id, lastAddedDate: null });
  };

  const updateRecurringTransaction = async (id: string, values: Partial<Omit<RecurringTransaction, 'id'>>) => {
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
  
  const getBudgetDetails = useCallback((forDate: Date = new Date()) => {
    const findCategoryById = (id: string, cats: (Category | SubCategory)[]): (Category | SubCategory | undefined) => {
        for (const cat of cats) {
            if (cat.id === id) return cat;
            if (cat.subCategories) {
                const found = findCategoryById(id, cat.subCategories);
                if (found) return found;
            }
        }
        return undefined;
    }

    return budgets.map(budget => {
      const category = findCategoryById(budget.categoryId, categories);
      
      let categoryName = "Unknown Category";
      let allCategoryNamesForBudget: string[] = [];

      if (category) {
        categoryName = category.name;
        allCategoryNamesForBudget = getSubCategoryNames(category);
      }
      
      const spent = allTransactions
        .filter(t => {
            const transactionDate = new Date(t.date);
            return t.type === 'expense' &&
                   allCategoryNamesForBudget.includes(t.category) &&
                   transactionDate.getMonth() === forDate.getMonth() && 
                   transactionDate.getFullYear() === forDate.getFullYear();
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
  }, [budgets, allTransactions, categories, getSubCategoryNames]);

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
    if(!collRef) return;
    const goalRef = doc(collRef, goalId);
    const goalDoc = await getDoc(goalRef);
    if(goalDoc.exists()) {
        const goal = goalDoc.data() as Goal;
        const newSavedAmount = goal.savedAmount + amount;
        await updateGoal(goalId, { savedAmount: newSavedAmount });
    }
  }

  const clearCollection = async (collectionName: string) => {
    const collRef = getCollectionRef(collectionName);
    if (!collRef) return;
    const snapshot = await getDocs(collRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
  }

  const clearTransactions = async () => {
    await clearCollection('transactions');
  }

  const clearAllData = async () => {
    await Promise.all([
      clearCollection('transactions'),
      clearCollection('categories'),
      clearCollection('budgets'),
      clearCollection('recurringTransactions'),
      clearCollection('goals'),
    ]);
  }


  const value = { 
        allTransactions, 
        paginatedTransactions,
        totalPaginatedTransactions,
        categories, 
        budgets,
        recurringTransactions,
        goals,
        loading, 
        hasMore,
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
        fetchPaginatedTransactions,
    };

  return (
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  );
};

export const useUserData = () => {
  const context = useContext(UserDataContext);
  if (context === undefined) {
    throw new Error('useUserData must be used within a UserDataProvider');
  }
  return context;
};
