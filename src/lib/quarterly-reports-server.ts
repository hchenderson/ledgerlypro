import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebaseAdmin";
import { calculateQuarterlyReportMetrics } from "@/lib/quarterly-report";
import { nextQuarterlySnapshotRevision } from "@/lib/quarterly-snapshots";
import { DEFAULT_REPORTING_TIME_ZONE, isValidReportingTimeZone, transactionLedgerDate } from "@/lib/ledger-date";
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

  const [transactionSnapshot, categories, allBudgets, goals, accounts, settingsSnapshot] = await Promise.all([
    userRef.collection("transactions").get(),
    getUserData<Category>(uid, "categories"),
    getUserData<Budget>(uid, "budgets"),
    getUserData<Goal>(uid, "goals"),
    getUserData<Account>(uid, "accounts"),
    userRef.collection("settings").doc("main").get(),
  ]);
  const configuredZone = settingsSnapshot.data()?.reportingTimeZone;
  const reportingTimeZone = typeof configuredZone === "string" && isValidReportingTimeZone(configuredZone)
    ? configuredZone
    : DEFAULT_REPORTING_TIME_ZONE;

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
    .map((document) => {
      const transaction = ({ ...document.data(), id: document.id }) as Transaction;
      const ledgerDate = transactionLedgerDate(transaction, reportingTimeZone);
      return { ...transaction, date: ledgerDate, ledgerDate };
    })
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
    range: { from: startDate, to: endDate },
    accountIds: normalizedAccountIds ?? [],
    defaultAccountId: primaryAccountId,
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
  const normalizedBudgetIds = budgets.map((budget) => budget.id).sort();
  const snapshotKey = `${period}--${hashReportScope([
    ...(normalizedAccountIds ?? ["all-accounts"]),
    "budgets",
    ...normalizedBudgetIds,
  ])}`;
  const reportRef = userRef.collection("reports").doc();
  const reportId = reportRef.id;
  const makeReportDocument = (revision: number, revisionOf?: string) => ({
    id: reportId,
    period,
    ...(normalizedAccountIds
      ? { accountIds: normalizedAccountIds }
      : {}),
    accountLabel,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    createdAt,
    calculationVersion: 5,
    snapshotKey,
    revision,
    ...(revisionOf ? { revisionOf } : {}),
    sourceDataMode: "current-ledger-at-generation" as const,
    effectiveFilters: {
      dateFrom: startDate.toISOString(),
      dateTo: endDate.toISOString(),
      accountIds: normalizedAccountIds ?? [],
      includedCategoryKeys: [],
      excludedCategoryKeys: [],
      transactionTypes: ["income", "expense"] as ("income" | "expense")[],
      includePending: false,
      includeTransfers: false,
      budgetIds: normalizedBudgetIds,
      reportingTimeZone,
    },
    ...metrics,
    ...(notes ? { notes } : {}),
  });
  let reportDocument = makeReportDocument(1);
  await adminDb.runTransaction(async (transaction) => {
    const priorSnapshot = await transaction.get(
      userRef.collection("reports").where("snapshotKey", "==", snapshotKey),
    );
    const existingReports = priorSnapshot.docs.map(
      (document) => ({ ...document.data(), id: document.id }) as QuarterlyReport,
    );
    const revisionMetadata = nextQuarterlySnapshotRevision(
      existingReports,
      snapshotKey,
    );
    reportDocument = makeReportDocument(
      revisionMetadata.revision,
      revisionMetadata.revisionOf,
    );
    transaction.create(reportRef, reportDocument);
  });

  return {
    ...reportDocument,
    createdAt: { seconds: createdAt.seconds, nanoseconds: createdAt.nanoseconds },
  } as unknown as QuarterlyReport;
}

function hashReportScope(accountIds: string[]): string {
  let hash = 2166136261;
  for (const character of accountIds.join("|")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
