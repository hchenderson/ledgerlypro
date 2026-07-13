
'use server';

import { getQuarter, startOfQuarter, endOfQuarter, getYear } from 'date-fns';
import type { Transaction, Category, Budget, Goal, QuarterlyReport } from '@/types';
import { adminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import { calculateQuarterlyReportMetrics } from '@/lib/quarterly-report';


async function getUserData(userId: string, collectionName: string) {
    if (!adminDb) throw new Error("Firebase Admin SDK not initialized.");
    const collRef = adminDb.collection('users').doc(userId).collection(collectionName);
    const snapshot = await collRef.get();
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

export async function deleteReport({ userId, reportId }: { userId: string, reportId: string }): Promise<{ success: boolean; error?: string }> {
    try {
        if (!userId) {
            throw new Error("User not authenticated.");
        }
        if (!adminDb) {
            throw new Error("Firebase Admin SDK is not initialized.");
        }

        const reportRef = adminDb.collection('users').doc(userId).collection('reports').doc(reportId);
        await reportRef.delete();

        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete report:", error);
        return { success: false, error: error.message };
    }
}

export async function generateAndSaveQuarterlyReport({ 
    userId, 
    referenceDate: referenceDateString,
    notes,
    budgetIds,
}: { 
    userId: string, 
    referenceDate: string,
    notes?: string;
    budgetIds?: string[];
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
    const [transactionsDocs, categories, allBudgets, goals] = await Promise.all([
        adminDb.collection('users').doc(userId).collection('transactions')
            .where('date', '>=', startDate.toISOString())
            .where('date', '<=', endDate.toISOString())
            .get(),
        getUserData(userId, 'categories') as Promise<Category[]>,
        getUserData(userId, 'budgets') as Promise<Budget[]>,
        getUserData(userId, 'goals') as Promise<Goal[]>
    ]);
    
    const budgets = budgetIds ? allBudgets.filter(b => budgetIds.includes(b.id)) : allBudgets;

    const transactionsInQuarter = transactionsDocs.docs.map(doc => doc.data() as Transaction);

    const {
      incomeSummary,
      expenseSummary,
      netIncome,
      budgetComparison,
      budgetComparisonTotals,
      goalsProgress,
      kpis,
    } = calculateQuarterlyReportMetrics({
      transactions: transactionsInQuarter,
      categories,
      budgets,
      goals,
    });

    const reportDoc = {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      createdAt: admin.firestore.Timestamp.now(),
      incomeSummary,
      expenseSummary,
      netIncome,
      budgetComparison,
      budgetComparisonTotals,
      goalsProgress,
      kpis,
      ...(notes && { notes }),
    };

    const reportsRef = adminDb.collection('users').doc(userId).collection('reports');
    const reportRef = reportsRef.doc(period);

    await reportRef.set(reportDoc);
    
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
