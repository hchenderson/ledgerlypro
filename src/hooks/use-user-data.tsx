
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Transaction, Category, SubCategory, Budget, RecurringTransaction } from '@/types';
import { defaultTransactions, defaultCategories, defaultBudgets, defaultRecurringTransactions } from '@/lib/data';
import { useAuth } from './use-auth';
import { addDays, addWeeks, addMonths, addYears, isBefore, startOfDay, parseISO } from 'date-fns';

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
  addSubCategory: (parentId: string, subCategory: SubCategory, parentPath?: string[]) => void;
  updateCategory: (id: string, newName: string) => void;
  deleteCategory: (id: string) => void;
  updateSubCategory: (categoryId: string, subCategoryId: string, newName: string, parentPath?: string[]) => void;
  deleteSubCategory: (categoryId: string, subCategoryId: string, parentPath?: string[]) => void;
  addBudget: (budget: Budget) => void;
  updateBudget: (id: string, values: Partial<Omit<Budget, 'id'>>) => void;
  deleteBudget: (id: string) => void;
  toggleFavoriteBudget: (id: string) => void;
  addRecurringTransaction: (transaction: RecurringTransaction) => void;
  updateRecurringTransaction: (id: string, values: Partial<Omit<RecurringTransaction, 'id'>>) => void;
  deleteRecurringTransaction: (id: string) => void;
  processRecurringTransactions: () => void;
  clearTransactions: () => void;
  clearAllData: () => void;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

const updateNestedCategory = (categories: SubCategory[], path: string[], newName: string): SubCategory[] => {
    const [currentId, ...restPath] = path;
    return categories.map(cat => {
        if (cat.id === currentId) {
            if (restPath.length === 0) {
                return { ...cat, name: newName };
            }
            return { ...cat, subCategories: updateNestedCategory(cat.subCategories || [], restPath, newName) };
        }
        return cat;
    });
};

const deleteNestedCategory = (categories: SubCategory[], path: string[]): SubCategory[] => {
    const [currentId, ...restPath] = path;
    if (restPath.length === 0) {
        return categories.filter(cat => cat.id !== currentId);
    }
    return categories.map(cat => {
        if (cat.id === currentId) {
            return { ...cat, subCategories: deleteNestedCategory(cat.subCategories || [], restPath) };
        }
        return cat;
    });
}

const addNestedCategory = (categories: SubCategory[], path: string[], newCategory: SubCategory): SubCategory[] => {
    const [currentId, ...restPath] = path;
     if (path.length === 0) {
        return [...categories, newCategory];
    }
    return categories.map(cat => {
        if (cat.id === currentId) {
             if (restPath.length === 0) {
                return { ...cat, subCategories: [...(cat.subCategories || []), newCategory] };
            }
            return { ...cat, subCategories: addNestedCategory(cat.subCategories || [], restPath, newCategory) };
        }
        return cat;
    });
}


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
      
      const keys = ['transactions', 'categories', 'budgets', 'recurringTransactions', 'lastRecurringCheck'];
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
                if (key in setters) {
                    setters[key as keyof typeof setters](JSON.parse(storedValue));
                }
            } else if (key in defaults) {
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

  const addSubCategory = (parentId: string, subCategory: SubCategory, parentPath: string[] = []) => {
    setCategories(prev => prev.map(cat => {
        if (cat.id === parentId) {
            return { ...cat, subCategories: addNestedCategory(cat.subCategories || [], parentPath, subCategory) };
        }
        return cat;
    }));
  };
  
  const updateSubCategory = (categoryId: string, subCategoryId: string, newName: string, parentPath: string[] = []) => {
      setCategories(prev => prev.map(cat => {
          if(cat.id === categoryId) {
              const newSubCategories = updateNestedCategory(cat.subCategories || [], [...parentPath, subCategoryId], newName);
              return {...cat, subCategories: newSubCategories};
          }
          return cat;
      }))
  }

  const deleteSubCategory = (categoryId: string, subCategoryId: string, parentPath: string[] = []) => {
        setCategories(prev => prev.map(cat => {
            if(cat.id === categoryId) {
                const newSubCategories = deleteNestedCategory(cat.subCategories || [], [...parentPath, subCategoryId]);
                return {...cat, subCategories: newSubCategories};
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

  const toggleFavoriteBudget = (id: string) => {
    setBudgets(prev => prev.map(b => (b.id === id ? { ...b, isFavorite: !b.isFavorite } : b)));
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
    let allNewTransactions: Transaction[] = [];
    const storageKey = getStorageKey('lastRecurringCheck');
    if (!storageKey) return;
    
    const lastCheckDate = parseISO(localStorage.getItem(storageKey) || new Date(0).toISOString());

    const updatedRecurring = recurringTransactions.map(rt => {
      const startDate = parseISO(rt.startDate);
      let nextDate = rt.lastAddedDate ? parseISO(rt.lastAddedDate) : startDate;

      while (isBefore(nextDate, today)) {
        switch(rt.frequency) {
          case 'daily': nextDate = addDays(nextDate, 1); break;
          case 'weekly': nextDate = addWeeks(nextDate, 1); break;
          case 'monthly': nextDate = addMonths(nextDate, 1); break;
          case 'yearly': nextDate = addYears(nextDate, 1); break;
        }

        if (isBefore(nextDate, today) || nextDate.getTime() === today.getTime()) {
           if (isBefore(lastCheckDate, nextDate)) {
             allNewTransactions.push({
                id: `txn_${Date.now()}_${Math.random()}`,
                date: nextDate.toISOString(),
                description: `(Recurring) ${rt.description}`,
                amount: rt.amount,
                type: rt.type,
                category: rt.category
            });
             rt.lastAddedDate = nextDate.toISOString();
           }
        }
      }
      return rt;
    });

    if (allNewTransactions.length > 0) {
      setTransactions(prev => [...allNewTransactions, ...prev]);
      setRecurringTransactions(updatedRecurring);
    }
    
    localStorage.setItem(storageKey, today.toISOString());
  }, [recurringTransactions, getStorageKey]);

  useEffect(() => {
    if (user && !loading) {
      processRecurringTransactions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

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
