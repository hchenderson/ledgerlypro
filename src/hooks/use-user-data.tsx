
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Transaction, Category, SubCategory } from '@/types';
import { defaultTransactions, defaultCategories } from '@/lib/data';
import { useAuth } from './use-auth';

interface UserDataContextType {
  transactions: Transaction[];
  categories: Category[];
  loading: boolean;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, values: Partial<Omit<Transaction, 'id'>>) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (category: Category) => void;
  addSubCategory: (parentId: string, subCategory: SubCategory) => void;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export const UserDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const getStorageKey = useCallback((key: string) => {
    if (!user) return null;
    return `${key}_${user.uid}`;
  }, [user]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      
      const transactionsKey = getStorageKey('transactions');
      const categoriesKey = getStorageKey('categories');

      if (transactionsKey && categoriesKey) {
        const storedTransactions = localStorage.getItem(transactionsKey);
        const storedCategories = localStorage.getItem(categoriesKey);

        if (storedTransactions) {
          setTransactions(JSON.parse(storedTransactions));
        } else {
          setTransactions(defaultTransactions);
        }

        if (storedCategories) {
          setCategories(JSON.parse(storedCategories));
        } else {
          setCategories(defaultCategories);
        }
      }
      setLoading(false);
    } else {
      // Clear data if user logs out
      setTransactions([]);
      setCategories([]);
    }
  }, [user, getStorageKey]);

  useEffect(() => {
    const transactionsKey = getStorageKey('transactions');
    if (user && transactionsKey && !loading) {
      localStorage.setItem(transactionsKey, JSON.stringify(transactions));
    }
  }, [transactions, user, getStorageKey, loading]);
  
  useEffect(() => {
    const categoriesKey = getStorageKey('categories');
    if (user && categoriesKey && !loading) {
      localStorage.setItem(categoriesKey, JSON.stringify(categories));
    }
  }, [categories, user, getStorageKey, loading]);

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

  return (
    <UserDataContext.Provider value={{ 
        transactions, 
        categories, 
        loading, 
        addTransaction, 
        updateTransaction,
        deleteTransaction,
        addCategory,
        addSubCategory
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
