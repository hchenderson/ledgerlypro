
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, doc, getDocs, onSnapshot, writeBatch, getDoc, setDoc, deleteDoc, query } from 'firebase/firestore';
import type { Transaction, Category, SubCategory, Budget, RecurringTransaction } from '@/types';
import { defaultTransactions, defaultCategories, defaultBudgets, defaultRecurringTransactions } from '@/lib/data';
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
  clearTransactions: () => Promise<void>;
  clearAllData: () => Promise<void>;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

const updateNestedValue = async (
    docRef: any, 
    path: string[],
    updateData: any,
    operation: 'add' | 'update' | 'delete'
) => {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    let data = docSnap.data();
    let currentLevel = data.subCategories || [];
    let levels = [currentLevel];
    
    for (const id of path) {
        const nextLevel = currentLevel.find((c: any) => c.id === id);
        if (nextLevel && nextLevel.subCategories) {
            currentLevel = nextLevel.subCategories;
            levels.push(currentLevel);
        } else {
            break;
        }
    }

    const applyOperation = (targetLevel: any[], targetId: string) => {
        const itemIndex = targetLevel.findIndex((item: any) => item.id === targetId);

        if (operation === 'add') {
             if (!targetLevel.find((item: any) => item.id === updateData.id)) {
                 targetLevel.push(updateData);
             }
        } else if (itemIndex !== -1) {
            if (operation === 'update') {
                targetLevel[itemIndex] = { ...targetLevel[itemIndex], ...updateData };
            } else if (operation === 'delete') {
                targetLevel.splice(itemIndex, 1);
            }
        }
    };
    
    if (path.length > 0) {
        const parentLevel = levels[levels.length - 2];
        const targetLevel = levels[levels.length - 1];
        const parentId = path[path.length - 1];
        
        const parentObject = parentLevel.find((c:any) => c.id === parentId);
        if(parentObject) {
             if(!parentObject.subCategories) parentObject.subCategories = [];
             applyOperation(parentObject.subCategories, updateData.id || path[path.length]);
        }
    } else {
        applyOperation(data.subCategories, updateData.id);
    }

    await setDoc(docRef, data, { merge: true });
};


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

  const seedDefaultData = useCallback(async () => {
    if (!user) return;
    const batch = writeBatch(db);
    
    const collections = {
        transactions: defaultTransactions,
        categories: defaultCategories,
        budgets: defaultBudgets,
        recurringTransactions: defaultRecurringTransactions
    };

    for (const [name, data] of Object.entries(collections)) {
        const collRef: any = getCollectionRef(name);
        data.forEach((item) => {
            const docRef = doc(collRef, item.id);
            const { icon, ...rest } = item as any;
            batch.set(docRef, rest);
        });
    }

    await batch.commit();
  }, [user, getCollectionRef]);
  
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

    const checkAndSeedData = async () => {
        const transactionsRef: any = getCollectionRef('transactions');
        const snapshot = await getDocs(transactionsRef);
        if (snapshot.empty) {
            await seedDefaultData();
        }
    };

    checkAndSeedData();

    const unsubscribers = ['transactions', 'categories', 'budgets', 'recurringTransactions'].map(name => {
      const collRef: any = getCollectionRef(name);
      return onSnapshot(query(collRef), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        switch (name) {
          case 'transactions': setTransactions(data as Transaction[]); break;
          case 'categories': setCategories(data as Category[]); break;
          case 'budgets': setBudgets(data as Budget[]); break;
          case 'recurringTransactions': setRecurringTransactions(data as RecurringTransaction[]); break;
        }
      });
    });

    setLoading(false);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, getCollectionRef, seedDefaultData]);


  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    const collRef: any = getCollectionRef('transactions');
    const newDocRef = doc(collRef);
    await setDoc(newDocRef, { ...transaction, id: newDocRef.id });
  };
  
  const updateTransaction = async (id: string, values: Partial<Omit<Transaction, 'id'>>) => {
      const docRef: any = doc(getCollectionRef('transactions'), id);
      await setDoc(docRef, values, { merge: true });
  }

  const deleteTransaction = async (id: string) => {
    const docRef: any = doc(getCollectionRef('transactions'), id);
    await deleteDoc(docRef);
  };
  
  const addCategory = async (category: Omit<Category, 'id'>) => {
    const collRef: any = getCollectionRef('categories');
    const newDocRef = doc(collRef);
    await setDoc(newDocRef, { ...category, id: newDocRef.id });
  };
  
  const updateCategory = async (id: string, newName: string) => {
    const docRef: any = doc(getCollectionRef('categories'), id);
    await setDoc(docRef, { name: newName }, { merge: true });
  }

  const deleteCategory = async (id: string) => {
    const docRef: any = doc(getCollectionRef('categories'), id);
    await deleteDoc(docRef);
  }

  const addSubCategory = async (parentId: string, subCategory: Omit<SubCategory, 'id'>, parentPath: string[] = []) => {
     const docRef: any = doc(getCollectionRef('categories'), parentId);
     const newId = `sub_${Date.now()}`;
     const newSubCategory = { ...subCategory, id: newId };

     const parentDoc = await getDoc(docRef);
     if(parentDoc.exists()){
         let currentSubCategories = parentDoc.data().subCategories || [];
         
         const addNested = (items: SubCategory[], path: string[]): SubCategory[] => {
             if (path.length === 0) {
                 return [...items, newSubCategory];
             }
             const [currentId, ...restPath] = path;
             return items.map(item => {
                 if (item.id === currentId) {
                     return { ...item, subCategories: addNested(item.subCategories || [], restPath)};
                 }
                 return item;
             });
         };
         const updatedSubCategories = addNested(currentSubCategories, parentPath);
         await setDoc(docRef, { subCategories: updatedSubCategories }, { merge: true });
     }
  };
  
  const updateSubCategory = async (categoryId: string, subCategoryId: string, newName: string, parentPath: string[] = []) => {
      const docRef: any = doc(getCollectionRef('categories'), categoryId);
      const parentDoc = await getDoc(docRef);
       if(parentDoc.exists()){
         let subCategories = parentDoc.data().subCategories || [];
         
         const updateNested = (items: SubCategory[], path: string[]): SubCategory[] => {
             const [currentId, ...restPath] = path;
             return items.map(item => {
                 if(item.id === currentId) {
                     if (restPath.length === 0) {
                         return { ...item, name: newName };
                     }
                     return { ...item, subCategories: updateNested(item.subCategories || [], restPath) };
                 }
                 return item;
             });
         };
         const updatedSubCategories = updateNested(subCategories, [...parentPath, subCategoryId]);
         await setDoc(docRef, { subCategories: updatedSubCategories }, { merge: true });
     }
  }

  const deleteSubCategory = async (categoryId: string, subCategoryId: string, parentPath: string[] = []) => {
      const docRef: any = doc(getCollectionRef('categories'), categoryId);
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

          const updatedSubCategories = deleteNested(subCategories, [...parentPath, subCategoryId]);
          await setDoc(docRef, { subCategories: updatedSubCategories }, { merge: true });
      }
  }

  const addBudget = async (budget: Omit<Budget, 'id'>) => {
    const collRef: any = getCollectionRef('budgets');
    const newDocRef = doc(collRef);
    await setDoc(newDocRef, { ...budget, id: newDocRef.id });
  };

  const updateBudget = async (id: string, values: Partial<Omit<Budget, 'id'>>) => {
    const docRef: any = doc(getCollectionRef('budgets'), id);
    await setDoc(docRef, values, { merge: true });
  };

  const deleteBudget = async (id: string) => {
    const docRef: any = doc(getCollectionRef('budgets'), id);
    await deleteDoc(docRef);
  };

  const toggleFavoriteBudget = async (id: string) => {
    const docRef: any = doc(getCollectionRef('budgets'), id);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) {
        await setDoc(docRef, { isFavorite: !docSnap.data().isFavorite }, { merge: true });
    }
  };
  
  const addRecurringTransaction = async (transaction: Omit<RecurringTransaction, 'id'>) => {
    const collRef: any = getCollectionRef('recurringTransactions');
    const newDocRef = doc(collRef);
    await setDoc(newDocRef, { ...transaction, id: newDocRef.id });
  };

  const updateRecurringTransaction = async (id: string, values: Partial<Omit<RecurringTransaction, 'id'>>) => {
    const docRef: any = doc(getCollectionRef('recurringTransactions'), id);
    await setDoc(docRef, values, { merge: true });
  };

  const deleteRecurringTransaction = async (id: string) => {
    const docRef: any = doc(getCollectionRef('recurringTransactions'), id);
    await deleteDoc(docRef);
  };
  
  const processRecurringTransactions = useCallback(async () => {
    if(!user) return;
    const today = startOfDay(new Date());
    const settingsDocRef: any = doc(db, 'users', user.uid, 'settings', 'recurring');
    const settingsDoc = await getDoc(settingsDocRef);
    const lastCheckDate = settingsDoc.exists() && settingsDoc.data().lastCheck ? parseISO(settingsDoc.data().lastCheck) : new Date(0);

    const batch = writeBatch(db);
    const transactionsCollRef: any = getCollectionRef('transactions');
    const recurringCollRef: any = getCollectionRef('recurringTransactions');

    for (const rt of recurringTransactions) {
        let nextDate = rt.lastAddedDate ? parseISO(rt.lastAddedDate) : parseISO(rt.startDate);

        while (isBefore(nextDate, today)) {
             switch(rt.frequency) {
                case 'daily': nextDate = addDays(nextDate, 1); break;
                case 'weekly': nextDate = addWeeks(nextDate, 1); break;
                case 'monthly': nextDate = addMonths(nextDate, 1); break;
                case 'yearly': nextDate = addYears(nextDate, 1); break;
            }

            if ((isBefore(nextDate, today) || nextDate.getTime() === today.getTime()) && isBefore(lastCheckDate, nextDate)) {
                 const newTransactionDoc = doc(transactionsCollRef);
                 batch.set(newTransactionDoc, {
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
    }
    
    await batch.commit();
    await setDoc(settingsDocRef, { lastCheck: today.toISOString() });

  }, [user, recurringTransactions, getCollectionRef]);

  useEffect(() => {
    if (user && !loading) {
      processRecurringTransactions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, processRecurringTransactions]);

 const clearCollection = async (collectionName: string) => {
    const collRef: any = getCollectionRef(collectionName);
    const snapshot = await getDocs(collRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
 }

  const clearTransactions = async () => {
    await clearCollection('transactions');
  };

  const clearAllData = async () => {
    await Promise.all([
        clearCollection('transactions'),
        clearCollection('categories'),
        clearCollection('budgets'),
        clearCollection('recurringTransactions')
    ]);
  }

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
