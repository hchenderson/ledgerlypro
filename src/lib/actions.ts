
'use server';

import type { Transaction } from "@/types";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export type DashboardAnalytics = {
  totalIncome: number;
  totalExpenses: number;
  currentBalance: number;
  overviewData: { name: string; income: number; expense: number }[];
  currentMonthIncome: number;
  currentMonthExpenses: number;
  savingsRate: number;
}

export async function getDashboardAnalytics({ 
    transactions,
    userId
}: { 
    transactions: Transaction[], 
    userId: string
}): Promise<DashboardAnalytics> {
    
    let startingBalance = 0;
    if (userId) {
        const settingsDocRef = doc(db, 'users', userId, 'settings', 'main');
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
            startingBalance = docSnap.data().startingBalance || 0;
        }
    }
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const currentMonthIncome = transactions
      .filter(t => {
          const transactionDate = new Date(t.date);
          return t.type === 'income' && transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear
      })
      .reduce((sum, t) => sum + t.amount, 0);
      
    const currentMonthExpenses = transactions
      .filter(t => {
          const transactionDate = new Date(t.date);
          return t.type === 'expense' && transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const currentBalance = startingBalance + totalIncome - totalExpenses;
    
    const monthlyData: Record<string, { income: number, expense: number }> = {};
    
    transactions.forEach(t => {
      const month = new Date(t.date).toLocaleString('default', { month: 'short' });
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expense: 0 };
      }
      monthlyData[month][t.type] += t.amount;
    });

    const overviewData = Object.entries(monthlyData).map(([name, values]) => ({
      name,
      ...values
    })).reverse();
    
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    return { totalIncome, totalExpenses, currentBalance, overviewData, currentMonthIncome, currentMonthExpenses, savingsRate };
}
