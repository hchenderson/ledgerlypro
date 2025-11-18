
'use server';

import { getQuarter, startOfQuarter, endOfQuarter, getYear } from 'date-fns';
import type { Transaction, Category, Budget, Goal, SubCategory, QuarterlyReport } from '@/types';
import { adminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';


async function getUserData(userId: string, collectionName: string) {
    if (!adminDb) throw new Error("Firebase Admin SDK not initialized.");
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
    if (!adminDb) {
        throw new Error("Firebase Admin SDK is not initialized. Please check server configuration.");
    }
    
    const referenceDate = new Date(referenceDateString);
    const quarter = getQuarter(referenceDate);
    const year = getYear(referenceDate);
    const period = `Q${quarter} ${year}`;
    const startDate = startOfQuarter(referenceDate);
    const endDate = endOfQuarter(referenceDate);
    
    // Fetch data concurrently
    const [transactionsDocs, categories, budgets, goals] = await Promise.all([
        adminDb.collection('users').doc(userId).collection('transactions')
            .where('date', '>=', startDate.toISOString())
            .where('date', '<=', endDate.toISOString())
            .get(),
        getUserData(userId, 'categories') as Promise<Category[]>,
        getUserData(userId, 'budgets') as Promise<Budget[]>,
        getUserData(userId, 'goals') as Promise<Goal[]>
    ]);

    const transactionsInQuarter = transactionsDocs.docs.map(doc => doc.data() as Transaction);

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

    const reportDoc = {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      incomeSummary,
      expenseSummary,
      netIncome,
      budgetComparison,
      goalsProgress,
      kpis,
      ...(notes && { notes }),
    };

    const reportsRef = adminDb.collection('users').doc(userId).collection('reports');
    const reportRef = reportsRef.doc(period);

    await reportRef.set({ ...reportDoc, createdAt: admin.firestore.Timestamp.now() });
    
    const finalReportData = (await reportRef.get()).data();
    if (!finalReportData) throw new Error("Could not retrieve the saved report.");
    
    // The `createdAt` field from Firestore is a Timestamp object, which is not serializable
    // for the client. We need to convert it to an object that can be serialized.
    const serializableReport = {
        ...finalReportData,
        createdAt: {
            seconds: finalReportData.createdAt.seconds,
            nanoseconds: finalReportData.createdAt.nanoseconds,
        }
    } as QuarterlyReport;
    
    return { success: true, report: serializableReport };
  } catch (error: any) {
    console.error("Failed to generate quarterly report:", error);
    return { success: false, error: error.message };
  }
}
