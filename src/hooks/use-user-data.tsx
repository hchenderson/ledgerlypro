
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Transaction, Category, SubCategory, Budget, RecurringTransaction } from '@/types';
import { defaultTransactions, defaultCategories, defaultBudgets, defaultRecurringTransactions } from '@/lib/data';
import { useAuth } from './use-auth';
import { isSameDay, isSameWeek, isSameMonth, isSameYear, parseISO, isBefore, startOfDay } from 'date-fns';

interface UserDataContextType {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
  loading: boolean;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, values: Partial<Omit<Transaction, 'id'>>) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (category: Category) => void;
  addSubCategory: (parentId: string, subCategory: SubCategory) => void;
  updateCategory: (id: string, newName: string) => void;
  deleteCategory: (id: string) => void;
  toggleFavoriteCategory: (id: string) => void;
  updateSubCategory: (parentId: string, subCategoryId: string, newName: string) => void;
  deleteSubCategory: (parentId: string, subCategoryId: string) => void;
  addBudget: (budget: Budget) => void;
  updateBudget: (id: string, values: Partial<Omit<Budget, 'id'>>) => void;
  deleteBudget: (id: string) => void;
  addRecurringTransaction: (transaction: RecurringTransaction) => void;
  updateRecurringTransaction: (id: string, values: Partial<Omit<RecurringTransaction, 'id'>>) => void;
  deleteRecurringTransaction: (id: string) => void;
  processRecurringTransactions: () => void;
  clearTransactions: () => void;
  clearAllData: () => void;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export const UserDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const getStorageKey = useCallback((key: string) => {
    if (!user) return null;
    return `${key}_${user.uid}`;
  }, [user]);

  // Load data from localStorage
  useEffect(() => {
    if (user) {
      setLoading(true);
      
      const keys = ['transactions', 'categories', 'budgets', 'recurringTransactions'];
      const setters = {
          'transactions': setTransactions,
          'categories': setCategories,
          'budgets': setBudgets,
          'recurringTransactions': setRecurringTransactions
      };
       const defaults = {
          'transactions': defaultTransactions,
          'categories': defaultCategories,
          'budgets': defaultBudgets,
          'recurringTransactions': defaultRecurringTransactions
      };

      keys.forEach(key => {
        const storageKey = getStorageKey(key);
        if (storageKey) {
            const storedValue = localStorage.getItem(storageKey);
            if (storedValue) {
                setters[key as keyof typeof setters](JSON.parse(storedValue));
            } else {
                 setters[key as keyof typeof setters](defaults[key as keyof typeof defaults]);
            }
        }
      });
      
      setLoading(false);
    } else {
      // Clear data if user logs out
      setTransactions([]);
      setCategories([]);
      setBudgets([]);
      setRecurringTransactions([]);
    }
  }, [user, getStorageKey]);

  // Save data to localStorage
  useEffect(() => {
    if (user && !loading) {
        const dataToStore = {
            transactions,
            categories,
            budgets,
            recurringTransactions,
        };
        for (const [key, value] of Object.entries(dataToStore)) {
            const storageKey = getStorageKey(key);
            if (storageKey) {
                localStorage.setItem(storageKey, JSON.stringify(value));
            }
        }
    }
  }, [transactions, categories, budgets, recurringTransactions, user, getStorageKey, loading]);

  const addTransaction = (transaction: Transaction) => {
    setTransactions(prev => [transaction, ...prev]);
  };
  
  const updateTransaction = (id: string, values: Partial<Omit<Transaction, 'id'>>) => {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...values } : t));
  }

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };
  
  const addCategory = (category: Category) => {
    setCategories(prev => [...prev, category]);
  };
  
  const updateCategory = (id: string, newName: string) => {
    setCategories(prev => prev.map(c => c.id === id ? {...c, name: newName} : c));
  }

  const deleteCategory = (id: string) => {
      setCategories(prev => prev.filter(c => c.id !== id));
  }

  const toggleFavoriteCategory = (id: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, isFavorite: !c.isFavorite } : c));
  }

  const addSubCategory = (parentId: string, subCategory: SubCategory) => {
    setCategories(prev => prev.map(cat => {
        if (cat.id === parentId) {
            return {
                ...cat,
                subCategories: [...(cat.subCategories || []), subCategory]
            };
        }
        return cat;
    }));
  };
  
  const updateSubCategory = (parentId: string, subCategoryId: string, newName: string) => {
      setCategories(prev => prev.map(cat => {
          if(cat.id === parentId) {
              const newSubCategories = cat.subCategories?.map(sub => {
                  if(sub.id === subCategoryId) {
                      return {...sub, name: newName};
                  }
                  return sub;
              });
              return {...cat, subCategories: newSubCategories};
          }
          return cat;
      }))
  }

  const deleteSubCategory = (parentId: string, subCategoryId: string) => {
        setCategories(prev => prev.map(cat => {
            if(cat.id === parentId) {
                return {...cat, subCategories: cat.subCategories?.filter(sub => sub.id !== subCategoryId)};
            }
            return cat;
        }))
  }

  const addBudget = (budget: Budget) => {
    setBudgets(prev => [...prev, budget]);
  };

  const updateBudget = (id: string, values: Partial<Omit<Budget, 'id'>>) => {
    setBudgets(prev => prev.map(b => (b.id === id ? { ...b, ...values } : b)));
  };

  const deleteBudget = (id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
  };
  
  const addRecurringTransaction = (transaction: RecurringTransaction) => {
    setRecurringTransactions(prev => [...prev, transaction]);
  };

  const updateRecurringTransaction = (id: string, values: Partial<Omit<RecurringTransaction, 'id'>>) => {
    setRecurringTransactions(prev => prev.map(rt => (rt.id === id ? { ...rt, ...values } : rt)));
  };

  const deleteRecurringTransaction = (id: string) => {
    setRecurringTransactions(prev => prev.filter(rt => rt.id !== id));
  };
  
  const processRecurringTransactions = useCallback(() => {
    const today = startOfDay(new Date());
    let newTransactions: Transaction[] = [];
    const updatedRecurring = recurringTransactions.map(rt => {
      const startDate = parseISO(rt.startDate);
      let lastAdded = rt.lastAddedDate ? parseISO(rt.lastAddedDate) : startDate;
      
      let shouldAdd = false;
      switch(rt.frequency) {
        case 'daily':
          if (isBefore(lastAdded, today)) shouldAdd = true;
          break;
        case 'weekly':
          if (!isSameWeek(lastAdded, today, { weekStartsOn: 1 })) shouldAdd = true;
          break;
        case 'monthly':
          if (!isSameMonth(lastAdded, today)) shouldAdd = true;
          break;
        case 'yearly':
          if (!isSameYear(lastAdded, today)) shouldAdd = true;
          break;
      }
      
      if (isBefore(startDate, today) && shouldAdd) {
        newTransactions.push({
          id: `txn_${Date.now()}_${Math.random()}`,
          date: today.toISOString(),
          description: `(Recurring) ${rt.description}`,
          amount: rt.amount,
          type: rt.type,
          category: rt.category
        });
        return {...rt, lastAddedDate: today.toISOString()};
      }
      return rt;
    });

    if (newTransactions.length > 0) {
      setTransactions(prev => [...newTransactions, ...prev]);
      setRecurringTransactions(updatedRecurring);
    }
  }, [recurringTransactions]);

  useEffect(() => {
    if (user && !loading) {
      processRecurringTransactions();
    }
  }, [user, loading, processRecurringTransactions]);

  const clearTransactions = () => {
    setTransactions([]);
  };

  const clearAllData = () => {
    setTransactions([]);
    setCategories([]);
    setBudgets([]);
    setRecurringTransactions([]);
  }

  return (
    <UserDataContext.Provider value={{ 
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
        toggleFavoriteCategory,
        updateSubCategory,
        deleteSubCategory,
        addBudget,
        updateBudget,
        deleteBudget,
        addRecurringTransaction,
        updateRecurringTransaction,
        deleteRecurringTransaction,
        processRecurringTransactions,
        clearTransactions,
        clearAllData,
    }}>
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
