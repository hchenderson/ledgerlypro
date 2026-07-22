import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebaseAdmin";
import { calculateQuarterlyReportMetrics } from "@/lib/quarterly-report";
import type { Budget, Category, Goal, QuarterlyReport, Transaction } from "@/types";

async function getUserData<T>(uid: string, collectionName: string): Promise<T[]> {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
  const snapshot = await adminDb.collection("users").doc(uid).collection(collectionName).get();
  return snapshot.docs.map((document) => ({ ...document.data(), id: document.id }) as T);
}

export async function deleteQuarterlyReport(uid: string, reportId: string) {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
  await adminDb.collection("users").doc(uid).collection("reports").doc(reportId).delete();
}

export async function generateQuarterlyReport({
  uid,
  reportYear,
  quarter,
  startDate,
  endDate,
  notes,
  budgetIds,
}: {
  uid: string;
  reportYear: number;
  quarter: number;
  startDate: Date;
  endDate: Date;
  notes?: string;
  budgetIds?: string[];
}): Promise<QuarterlyReport> {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");

  const period = `Q${quarter} ${reportYear}`;
  const userRef = adminDb.collection("users").doc(uid);

  const [transactionSnapshot, categories, allBudgets, goals] = await Promise.all([
    userRef.collection("transactions")
      .where("date", ">=", startDate.toISOString())
      .where("date", "<=", endDate.toISOString())
      .get(),
    getUserData<Category>(uid, "categories"),
    getUserData<Budget>(uid, "budgets"),
    getUserData<Goal>(uid, "goals"),
  ]);

  const transactions = transactionSnapshot.docs.map((document) => document.data() as Transaction);
  const budgets = budgetIds?.length
    ? allBudgets.filter((budget) => budgetIds.includes(budget.id))
    : allBudgets;
  const metrics = calculateQuarterlyReportMetrics({
    transactions,
    categories,
    budgets,
    goals,
    reportYear,
  });
  const createdAt = Timestamp.now();
  const reportDocument = {
    period,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    createdAt,
    calculationVersion: 2,
    ...metrics,
    ...(notes ? { notes } : {}),
  };

  await userRef.collection("reports").doc(period).set(reportDocument);

  return {
    ...reportDocument,
    createdAt: { seconds: createdAt.seconds, nanoseconds: createdAt.nanoseconds },
  } as QuarterlyReport;
}
