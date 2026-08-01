import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebaseAdmin";
import { calculateQuarterlyReportMetrics } from "@/lib/quarterly-report";
import type {
  Account,
  Budget,
  Category,
  Goal,
  QuarterlyReport,
  Transaction,
} from "@/types";

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
  accountIds,
}: {
  uid: string;
  reportYear: number;
  quarter: number;
  startDate: Date;
  endDate: Date;
  notes?: string;
  budgetIds?: string[];
  accountIds?: string[];
}): Promise<QuarterlyReport> {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");

  const period = `Q${quarter} ${reportYear}`;
  const userRef = adminDb.collection("users").doc(uid);

  const [transactionSnapshot, categories, allBudgets, goals, accounts] = await Promise.all([
    userRef.collection("transactions")
      .where("date", ">=", startDate.toISOString())
      .where("date", "<=", endDate.toISOString())
      .get(),
    getUserData<Category>(uid, "categories"),
    getUserData<Budget>(uid, "budgets"),
    getUserData<Goal>(uid, "goals"),
    getUserData<Account>(uid, "accounts"),
  ]);

  const normalizedAccountIds = accountIds?.length
    ? [...new Set(accountIds)].sort()
    : undefined;
  const accountMap = new Map(
    accounts.map((account) => [account.id, account]),
  );
  if (
    normalizedAccountIds?.some(
      (accountId) => !accountMap.has(accountId),
    )
  ) {
    throw new Error("One or more report accounts are invalid.");
  }
  const accountSet = normalizedAccountIds
    ? new Set(normalizedAccountIds)
    : null;
  const primaryAccountId =
    accounts.find((account) => account.isDefault)?.id ??
    accounts.find((account) => !account.isArchived)?.id;
  const transactions = transactionSnapshot.docs
    .map((document) => document.data() as Transaction)
    .filter(
      (transaction) =>
        !accountSet ||
        accountSet.has(
          transaction.accountId ?? primaryAccountId ?? "",
        ),
    );
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
  const accountLabel = normalizedAccountIds
    ? normalizedAccountIds
        .map(
          (accountId) =>
            accountMap.get(accountId)?.name ?? "Unknown account",
        )
        .join(", ")
    : "All accounts";
  const scopeHash = normalizedAccountIds
    ? hashReportScope(normalizedAccountIds)
    : null;
  const reportId = scopeHash
    ? `${period}--accounts-${scopeHash}`
    : period;
  const reportDocument = {
    id: reportId,
    period,
    ...(normalizedAccountIds
      ? { accountIds: normalizedAccountIds }
      : {}),
    accountLabel,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    createdAt,
    calculationVersion: 3,
    ...metrics,
    ...(notes ? { notes } : {}),
  };

  await userRef.collection("reports").doc(reportId).set(reportDocument);

  return {
    ...reportDocument,
    createdAt: { seconds: createdAt.seconds, nanoseconds: createdAt.nanoseconds },
  } as QuarterlyReport;
}

function hashReportScope(accountIds: string[]): string {
  let hash = 2166136261;
  for (const character of accountIds.join("|")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
