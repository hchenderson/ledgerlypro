
'use server';

import { collection, doc, setDoc, getDocs, query, where, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { startOfQuarter, endOfQuarter, isWithinInterval, getQuarter } from 'date-fns';
import type { Transaction, Category, Budget, Goal, SubCategory, QuarterlyReport } from '@/types';
import { getAuth } from 'firebase-admin/auth';
import { getAdminDb } from './firebase-admin';

async function getUserData(userId: string, collectionName: string) {
    const adminDb = getAdminDb();
    if (!adminDb) {
        throw new Error("Firebase Admin SDK is not initialized.");
    }
    const collRef = adminDb.collection('users').doc(userId).collection(collectionName);
    const snapshot = await collRef.get();
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

function summarizeByCategory(transactions: Transaction[], type: 'income' | 'expense', categories: Category[]) {
    const findMainCategory = (subCategoryName: string, allCategories: Category[]): string => {
        for (const mainCat of allCategories) {
            if (mainCat.name === subCategoryName) return mainCat.name;
            const findInSubs = (subs: SubCategory[], mainCatName: string): string | null => {
                for (const sub of subs) {
                    if (sub.name === subCategoryName) return mainCatName;
                    if (sub.subCategories) {
                        const found = findInSubs(sub.subCategories, mainCatName);
                        if (found) return found;
                    }
                }
                return null;
            };
            if (mainCat.subCategories) {
                const found = findInSubs(mainCat.subCategories, mainCat.name);
                if (found) return found;
            }
        }
        return 'Uncategorized';
    };

    const filtered = transactions.filter(t => t.type === type);
    const totals: Record<string, number> = {};
    filtered.forEach(t => {
        const mainCategory = findMainCategory(t.category, categories);
        totals[mainCategory] = (totals[mainCategory] || 0) + t.amount;
    });
    return totals;
}

const getSubCategoryNames = (category: Category | SubCategory): string[] => {
    let names = [category.name];
    if (category.subCategories) {
        category.subCategories.forEach(sub => {
            names = [...names, ...getSubCategoryNames(sub)];
        });
    }
    return names;
};

export async function generateAndSaveQuarterlyReport({ 
    userId, 
    referenceDate: referenceDateString,
    notes,
}: { 
    userId: string, 
    referenceDate: string,
    notes?: string;
}): Promise<{ success: boolean; error?: string; report?: Partial<QuarterlyReport> }> {
  try {
    if (!userId) {
        throw new Error("User not authenticated.");
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
        throw new Error("Firebase Admin SDK is not initialized.");
    }
    
    const referenceDate = new Date(referenceDateString);
    const startDate = startOfQuarter(referenceDate);
    const endDate = endOfQuarter(referenceDate);

    const transactions = await getUserData(userId, 'transactions') as Transaction[];
    const categories = await getUserData(userId, 'categories') as Category[];
    const budgets = await getUserData(userId, 'budgets') as Budget[];
    const goals = await getUserData(userId, 'goals') as Goal[];


    const transactionsInQuarter = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
    });

    const income = transactionsInQuarter
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactionsInQuarter
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netIncome = income - expenses;

    const incomeSummary = summarizeByCategory(transactionsInQuarter, 'income', categories);
    const expenseSummary = summarizeByCategory(transactionsInQuarter, 'expense', categories);
    
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

    const budgetComparison = budgets.map(budget => {
        const category = findCategoryById(budget.categoryId, categories);
        const categoryName = category?.name || 'Unknown Category';
        const allCategoryNamesForBudget = category ? getSubCategoryNames(category) : [];

        // Adjust budget amount for the quarter if it's monthly
        const budgetAmountForPeriod = budget.period === 'monthly' ? budget.amount * 3 : budget.amount;

        const actual = transactionsInQuarter
            .filter(t => t.type === 'expense' && allCategoryNamesForBudget.includes(t.category))
            .reduce((sum, t) => sum + t.amount, 0);
        
        const variance = budgetAmountForPeriod - actual;
        const percentUsed = budgetAmountForPeriod > 0 ? (actual / budgetAmountForPeriod) * 100 : 0;

        return { categoryName, budget: budgetAmountForPeriod, actual, variance, percentUsed };
    });

    const goalsProgress = goals.map(goal => ({
        name: goal.name,
        targetAmount: goal.targetAmount,
        savedAmount: goal.savedAmount,
        progress: goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0,
    }));


    const kpis = {
      profitMargin: income > 0 ? (netIncome / income) * 100 : 0,
      expenseToIncomeRatio: income > 0 ? (expenses / income) * 100 : 0,
    };

    const period = `${startDate.getFullYear()}-Q${getQuarter(startDate)}`;
    
    const reportDoc: Omit<QuarterlyReport, 'createdAt'> = {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      incomeSummary,
      expenseSummary,
      netIncome,
      budgetComparison,
      goalsProgress,
      kpis,
      notes: notes || undefined,
    };

    const reportsRef = adminDb.collection('users').doc(userId).collection('reports');
    const reportRef = reportsRef.doc(period);

    await reportRef.set({ ...reportDoc, createdAt: new Date() });
    
    const finalReport = await reportRef.get();
    
    return { success: true, report: finalReport.data() as QuarterlyReport };
  } catch (error: any) {
    console.error("Failed to generate quarterly report:", error);
    return { success: false, error: error.message };
  }
}
