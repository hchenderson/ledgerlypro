
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, doc, getDocs, onSnapshot, writeBatch, getDoc, setDoc, deleteDoc, query } from 'firebase/firestore';
import type { Transaction, Category, SubCategory, Budget, RecurringTransaction, Goal } from '@/types';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase';
import { addDays, addWeeks, addMonths, addYears, isBefore, startOfDay, parseISO, isToday } from 'date-fns';

interface UserDataContextType {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
  goals: Goal[];
  loading: boolean;
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
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export const UserDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const getCollectionRef = useCallback((collectionName: string) => {
    if (!user) return null;
    return collection(db, 'users', user.uid, collectionName);
  }, [user]);

  const processRecurringTransactions = useCallback(async () => {
    if (!user || recurringTransactions.length === 0) return;
  
    const today = startOfDay(new Date());
    const batch = writeBatch(db);
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
        await batch.commit();
    } catch(e) {
        console.error("Error processing recurring transactions batch: ", e)
    }

  }, [user, recurringTransactions, getCollectionRef]);
  
  useEffect(() => {
    if (user && !loading && recurringTransactions.length > 0) {
      processRecurringTransactions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, recurringTransactions]);


  useEffect(() => {
    if (!user) {
      setLoading(false);
      setTransactions([]);
      setCategories([]);
      setBudgets([]);
      setRecurringTransactions([]);
      setGoals([]);
      return;
    }

    setLoading(true);

    const collectionsToSync = ['transactions', 'categories', 'budgets', 'recurringTransactions', 'goals'];
    const unsubscribers = collectionsToSync.map(name => {
      const collRef = getCollectionRef(name);
      if (!collRef) return () => {};
      
      return onSnapshot(query(collRef), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        switch (name) {
          case 'transactions': setTransactions(data as Transaction[]); break;
          case 'categories': setCategories(data as Category[]); break;
          case 'budgets': setBudgets(data as Budget[]); break;
          case 'recurringTransactions': setRecurringTransactions(data as RecurringTransaction[]); break;
          case 'goals': setGoals(data as Goal[]); break;
        }
      }, (error) => {
        console.error(`Error fetching ${name}:`, error);
      });
    });
    
    setLoading(false);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, getCollectionRef]);


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

    const getAllSubCategoryNames = (category: Category | SubCategory): string[] => {
        let names = [category.name];
        if (category.subCategories) {
            category.subCategories.forEach(sub => {
                names = [...names, ...getAllSubCategoryNames(sub)];
            });
        }
        return names;
    }

    return budgets.map(budget => {
      const category = findCategoryById(budget.categoryId, categories);
      
      let categoryName = "Unknown Category";
      let allCategoryNamesForBudget: string[] = [];

      if (category) {
        categoryName = category.name;
        allCategoryNamesForBudget = getAllSubCategoryNames(category);
      }
      
      const spent = transactions
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
  }, [budgets, transactions, categories]);

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
        transactions, 
        categories, 
        budgets,
        recurringTransactions,
        goals,
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
