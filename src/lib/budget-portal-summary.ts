import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { calculateBudgetDetails } from "@/lib/budget-analytics";
import {
  findCategoryWithPathById,
  getCategorySubtreeIdsAndNames,
  normalizeCategoryName,
} from "@/lib/category-tree";
import {
  financialReportingTransactions,
  financialTransactionAmount,
} from "@/lib/financial-summary";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  DEFAULT_REPORTING_TIME_ZONE,
  isValidReportingTimeZone,
  ledgerDateToDate,
  todayLedgerDate,
  transactionLedgerDate,
} from "@/lib/ledger-date";
import { moneyMinor } from "@/lib/money";
import type {
  BudgetPortalBudgetSummary,
  BudgetPortalFreshness,
  BudgetPortalSummaryResponse,
} from "@/lib/budget-portal-types";
import type { Budget, Category, PlaidItem, Transaction } from "@/types";

function asIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return value;
  return null;
}

function budgetDate(budget: Budget, today: string) {
  const [, month] = today.split("-").map(Number);
  return ledgerDateToDate(
    `${budget.year}-${String(month).padStart(2, "0")}-01`,
  );
}

export function calculatePortalBudgetSummaries({
  budgets,
  transactions,
  categories,
  assignedBudgetIds,
  reportingTimeZone,
  now = new Date(),
}: {
  budgets: Budget[];
  transactions: Transaction[];
  categories: Category[];
  assignedBudgetIds: string[];
  reportingTimeZone: string;
  now?: Date;
}): { budgets: BudgetPortalBudgetSummary[]; unavailableAssignments: number } {
  const assigned = new Set(assignedBudgetIds);
  const available = budgets.filter((budget) => assigned.has(budget.id));
  const today = todayLedgerDate(now, reportingTimeZone);
  const reportingLines = financialReportingTransactions(transactions);
  const summaries = available.map((budget) => {
    const forDate = budgetDate(budget, today);
    const detail = calculateBudgetDetails({
      activeBudgets: [budget],
      transactions,
      categories,
      forDate,
    }, budget.year)[0];
    const categoryResult = findCategoryWithPathById(budget.categoryId, categories);
    const subtree = categoryResult
      ? getCategorySubtreeIdsAndNames(categoryResult.category)
      : { ids: [budget.categoryId], names: [] };
    const year = budget.year;
    const month = forDate.getMonth();
    const grouped = new Map<string, { categoryId: string | null; name: string; spendingMinor: number }>();
    for (const transaction of reportingLines) {
      if (transaction.type !== "expense") continue;
      const transactionDate = ledgerDateToDate(transactionLedgerDate(transaction, reportingTimeZone));
      if (transactionDate.getFullYear() !== year) continue;
      if (budget.period === "monthly" && transactionDate.getMonth() !== month) continue;
      const matches = transaction.categoryId
        ? subtree.ids.includes(transaction.categoryId)
        : subtree.names.includes(normalizeCategoryName(transaction.category));
      if (!matches) continue;
      const key = transaction.categoryId ?? `name:${normalizeCategoryName(transaction.category)}`;
      const name = transaction.category || "Uncategorized";
      const current = grouped.get(key) ?? { categoryId: transaction.categoryId ?? null, name, spendingMinor: 0 };
      current.spendingMinor += Math.round(financialTransactionAmount(transaction) * 100);
      grouped.set(key, current);
    }
    const budgetedMinor = moneyMinor(budget);
    const spendingMinor = Math.round((detail?.spent ?? 0) * 100);
    const remainingMinor = budgetedMinor - spendingMinor;
    const overlapsOtherAssignedBudget = available.some((other) => {
      if (other.id === budget.id) return false;
      const otherResult = findCategoryWithPathById(other.categoryId, categories);
      if (!otherResult) return false;
      const otherSubtree = getCategorySubtreeIdsAndNames(otherResult.category);
      return subtree.ids.includes(other.categoryId) || otherSubtree.ids.includes(budget.categoryId);
    });
    return {
      id: budget.id,
      name: detail?.categoryName ?? categoryResult?.path.map((item) => item.name).join(" > ") ?? "Unavailable budget",
      period: budget.period,
      periodLabel: budget.period === "yearly"
        ? String(year)
        : new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
            new Date(Date.UTC(year, month, 1)),
          ),
      budgetedMinor,
      spendingMinor,
      remainingMinor,
      percentageUsed: budgetedMinor > 0 ? (spendingMinor / budgetedMinor) * 100 : null,
      overBudget: remainingMinor < 0,
      categoryBreakdown: [...grouped.values()].sort((a, b) => b.spendingMinor - a.spendingMinor),
      overlapsOtherAssignedBudget,
    } satisfies BudgetPortalBudgetSummary;
  });
  return {
    budgets: summaries,
    unavailableAssignments: assignedBudgetIds.length - summaries.length,
  };
}

function freshnessFor(items: PlaidItem[], reviewedThrough: string | null, now: Date): BudgetPortalFreshness {
  const active = items.filter((item) => item.status !== "disconnected");
  const syncDates = active.map((item) => item.lastSuccessfulSync).filter((value): value is string => Boolean(value)).sort();
  const latest = syncDates.at(-1) ?? null;
  const anyFailed = active.some((item) => ["needs-attention", "delayed"].includes(item.status));
  const missing = active.some((item) => !item.lastSuccessfulSync);
  let bankCoverage: BudgetPortalFreshness["bankCoverage"] = "unknown";
  if (active.length > 0 && anyFailed) bankCoverage = "failed";
  else if (active.length > 0 && missing) bankCoverage = "partial";
  else if (latest) bankCoverage = now.getTime() - new Date(latest).getTime() > 48 * 60 * 60 * 1_000 ? "stale" : "current";
  return {
    summaryUpdatedAt: now.toISOString(),
    bankActivitySyncedAt: latest,
    bankCoverage,
    reviewedThrough,
    reviewedThroughScope: "ledger",
  };
}

export async function buildBudgetPortalSummary({
  ownerUid,
  budgetIds,
  displayName,
  now = new Date(),
}: {
  ownerUid: string;
  budgetIds: string[];
  displayName: string | null;
  now?: Date;
}): Promise<BudgetPortalSummaryResponse> {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
  const user = adminDb.collection("users").doc(ownerUid);
  const [budgetsSnapshot, transactionsSnapshot, categoriesSnapshot, settingsSnapshot, plaidSnapshot, portalSettingsSnapshot] = await Promise.all([
    user.collection("budgets").get(),
    user.collection("transactions").get(),
    user.collection("categories").get(),
    user.collection("settings").doc("main").get(),
    user.collection("plaidItems").get(),
    adminDb.collection("budgetPortalSettings").doc(ownerUid).get(),
  ]);
  const settings = settingsSnapshot.data();
  const configuredTimeZone = typeof settings?.reportingTimeZone === "string" ? settings.reportingTimeZone : "";
  const reportingTimeZone = isValidReportingTimeZone(configuredTimeZone)
    ? configuredTimeZone
    : DEFAULT_REPORTING_TIME_ZONE;
  const calculation = calculatePortalBudgetSummaries({
    budgets: budgetsSnapshot.docs.map((document) => ({ ...document.data(), id: document.id }) as Budget),
    transactions: transactionsSnapshot.docs.map((document) => ({ ...document.data(), id: document.id }) as Transaction),
    categories: categoriesSnapshot.docs.map((document) => ({ ...document.data(), id: document.id }) as Category),
    assignedBudgetIds: budgetIds,
    reportingTimeZone,
    now,
  });
  const portalSettings = portalSettingsSnapshot.data();
  const reviewedThrough = typeof portalSettings?.reviewedThrough === "string" ? portalSettings.reviewedThrough : null;
  return {
    viewer: { displayName },
    ...calculation,
    freshness: freshnessFor(
      plaidSnapshot.docs.map((document) => ({ ...document.data(), id: document.id }) as PlaidItem),
      reviewedThrough,
      now,
    ),
    notice: calculation.budgets.some((budget) => budget.overlapsOtherAssignedBudget)
      ? "Some budget cards overlap by category. Each card is accurate on its own; do not add overlapping cards together."
      : null,
  };
}

export function portalTimestampIso(value: unknown) {
  return asIso(value);
}
