
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, doc, getDocs, onSnapshot, writeBatch, getDoc, setDoc, deleteDoc, query } from 'firebase/firestore';
import type { Transaction, Category, SubCategory, Budget, RecurringTransaction } from '@/types';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase';
import { addDays, addWeeks, addMonths, addYears, isBefore, startOfDay, parseISO } from 'date-fns';

interface UserDataContextType {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
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
  processRecurringTransactions: () => Promise<void>;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export const UserDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const getCollectionRef = useCallback((collectionName: string) => {
    if (!user) return null;
    return collection(db, 'users', user.uid, collectionName);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setTransactions([]);
      setCategories([]);
      setBudgets([]);
      setRecurringTransactions([]);
      return;
    }

    setLoading(true);

    const unsubscribers = ['transactions', 'categories', 'budgets', 'recurringTransactions'].map(name => {
      const collRef = getCollectionRef(name);
      if (!collRef) return () => {};
      
      return onSnapshot(query(collRef), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        switch (name) {
          case 'transactions': setTransactions(data as Transaction[]); break;
          case 'categories': setCategories(data as Category[]); break;
          case 'budgets': setBudgets(data as Budget[]); break;
          case 'recurringTransactions': setRecurringTransactions(data as RecurringTransaction[]); break;
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
    await setDoc(newDocRef, { ...transaction, id: newDocRef.id });
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
  
  const processRecurringTransactions = useCallback(async () => {
    if(!user) return;
    const today = startOfDay(new Date());
    const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'recurring');
    const settingsDoc = await getDoc(settingsDocRef);
    const lastCheckDate = settingsDoc.exists() && settingsDoc.data().lastCheck ? parseISO(settingsDoc.data().lastCheck) : new Date(0);

    const batch = writeBatch(db);
    const transactionsCollRef = getCollectionRef('transactions');
    if (!transactionsCollRef) return;
    const recurringCollRef = getCollectionRef('recurringTransactions');
    if (!recurringCollRef) return;

    for (const rt of recurringTransactions) {
        let nextDate = rt.lastAddedDate ? addDays(parseISO(rt.lastAddedDate), 1) : parseISO(rt.startDate);

        while (isBefore(nextDate, today) || nextDate.getTime() === today.getTime()) {
             if (isBefore(lastCheckDate, nextDate)) {
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

             switch(rt.frequency) {
                case 'daily': nextDate = addDays(nextDate, 1); break;
                case 'weekly': nextDate = addWeeks(nextDate, 1); break;
                case 'monthly': nextDate = addMonths(nextDate, 1); break;
                case 'yearly': nextDate = addYears(nextDate, 1); break;
            }
        }
    }
    
    await batch.commit();
    await setDoc(settingsDocRef, { lastCheck: today.toISOString() }, { merge: true });

  }, [user, recurringTransactions, getCollectionRef]);

  useEffect(() => {
    if (user && !loading && recurringTransactions.length > 0) {
      processRecurringTransactions();
    }
  }, [user, loading, recurringTransactions, processRecurringTransactions]);

  const value = { 
        transactions, 
        categories, 
        budgets,
        recurringTransactions,
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
        processRecurringTransactions,
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
