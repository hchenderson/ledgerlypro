import {
  addDays,
  addWeeks,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

import { calculateAccountBalanceBefore } from "@/lib/accounts";
import {
  financialReportingTransactions,
  financialTransactionAmount,
} from "@/lib/financial-summary";
import { DEFAULT_REPORTING_TIME_ZONE, transactionLedgerDate } from "@/lib/ledger-date";
import type {
  Account,
  ForecastSettings,
  RecurringOccurrence,
  RecurringTransaction,
  Transaction,
} from "@/types";
import {
  expandRecurringBetween,
  type ForecastTx,
} from "./expandRecurringBetween";
import { normalizeMerchant } from "./merchant-normalize";
import {
  buildForecastSeries,
  type ForecastPoint,
} from "./series";

type ForecastType = "income" | "expense";
type EstimateComponent =
  | "merchant-estimate"
  | "category-estimate"
  | "residual-estimate";
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ForecastTotals {
  income: number;
  expenses: number;
  net: number;
}

export interface ForecastContract {
  start: Date;
  endInclusive: Date;
  horizonDays: number;
  historyStartInclusive: Date;
  historyEndExclusive: Date;
  lookbackWeeks: number;
  reportingTimeZone: string;
  includesToday: true;
}

export interface ForecastComponentSummary extends ForecastTotals {
  transactionCount: number;
}

export interface ForwardForecastResult {
  contract: ForecastContract;
  series: ForecastPoint[];
  historicalActuals: ForecastTx[];
  recurringFuture: ForecastTx[];
  baseline: ForecastTx[];
  forecastTransactions: ForecastTx[];
  totals: ForecastComponentSummary;
  openingBalance: number;
  projectedEndingBalance: number;
  components: {
    scheduled: ForecastComponentSummary;
    merchantEstimated: ForecastComponentSummary;
    categoryEstimated: ForecastComponentSummary;
    residualEstimated: ForecastComponentSummary;
  };
  diagnostics: {
    fallbackUsed: boolean;
    excludedMaterializedRecurringLines: number;
    excludedReconciledActualLines: number;
    merchantModelCount: number;
    categoryModelCount: number;
    residualHistoryLineCount: number;
    recurringOverlapNeedsReview: boolean;
  };
  accountScope: {
    allAccounts: boolean;
    accountIds: string[];
  };
}

export interface BuildForwardForecastInput {
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  recurringOccurrences?: RecurringOccurrence[];
  accounts: Account[];
  primaryAccountId?: string | null;
  selectedAccountIds?: string[];
  forecastSettings?: ForecastSettings;
  startDate: Date;
  horizonDays?: number;
  lookbackWeeks?: number;
  minimumActiveWeeks?: number;
  reportingTimeZone?: string;
}

interface HistoryLine extends ForecastTx {
  source: "actual";
  categoryKey: string;
  merchantKey: string;
}

interface ModelProfile {
  key: string;
  label: string;
  type: ForecastType;
  category?: string;
  categoryId?: string;
  weeklyAverage: number;
  weekdayWeights: Record<Weekday, number>;
  historyLineIds: string[];
}

const emptyWeekdays = (): Record<Weekday, number> => ({
  0: 0,
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  6: 0,
});

function normalizeWeights(values: Record<Weekday, number>) {
  const total = Object.values(values).reduce(
    (sum, value) => sum + value,
    0,
  );
  if (total <= 0) {
    return {
      0: 1 / 7,
      1: 1 / 7,
      2: 1 / 7,
      3: 1 / 7,
      4: 1 / 7,
      5: 1 / 7,
      6: 1 / 7,
    } satisfies Record<Weekday, number>;
  }
  return Object.fromEntries(
    Object.entries(values).map(([day, value]) => [day, value / total]),
  ) as unknown as Record<Weekday, number>;
}

function categoryKey(transaction: Pick<Transaction, "category" | "categoryId">) {
  return transaction.categoryId
    ? `id:${transaction.categoryId}`
    : `name:${(transaction.category || "Uncategorized").trim().toLocaleLowerCase()}`;
}

function weekKey(date: string) {
  return format(
    startOfWeek(parseISO(date), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
}

function isInAccountScope(
  accountId: string | undefined,
  selectedAccountIds: string[],
  primaryAccountId?: string | null,
) {
  return (
    selectedAccountIds.length === 0 ||
    selectedAccountIds.includes(accountId ?? primaryAccountId ?? "")
  );
}

function toHistoryLine(transaction: Transaction): HistoryLine {
  const normalizedMerchant = normalizeMerchant(
    transaction.merchantName ?? transaction.description,
  );
  return {
    id: transaction.id,
    date: transactionLedgerDate(transaction),
    amount: financialTransactionAmount(transaction),
    type: transaction.type as ForecastType,
    category: transaction.category,
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    merchantName: transaction.merchantName,
    description: transaction.description,
    source: "actual",
    categoryKey: categoryKey(transaction),
    merchantKey: normalizedMerchant.merchantKey,
  };
}

function modelProfiles(
  lines: HistoryLine[],
  keyForLine: (line: HistoryLine) => string | null,
  labelForLine: (line: HistoryLine) => string,
  lookbackWeeks: number,
  minimumActiveWeeks: number,
): ModelProfile[] {
  const groups = new Map<string, HistoryLine[]>();
  for (const line of lines) {
    const modelKey = keyForLine(line);
    if (!modelKey) continue;
    const key = `${line.type}:${modelKey}`;
    const group = groups.get(key) ?? [];
    group.push(line);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([key, group]) => {
      const activeWeeks = new Set(group.map((line) => weekKey(line.date)));
      if (activeWeeks.size < minimumActiveWeeks) return [];

      const weekdaySums = emptyWeekdays();
      let total = 0;
      for (const line of group) {
        total += line.amount;
        const weekday = parseISO(line.date).getDay() as Weekday;
        weekdaySums[weekday] += line.amount;
      }
      const representative = group[0];
      return [{
        key,
        label: labelForLine(representative),
        type: representative.type,
        category: representative.category,
        categoryId: representative.categoryId,
        // Empty weeks are part of the lookback. Dividing by the complete
        // window prevents sparse history from masquerading as weekly activity.
        weeklyAverage: total / lookbackWeeks,
        weekdayWeights: normalizeWeights(weekdaySums),
        historyLineIds: group.map((line) => line.id),
      }];
    });
}

function residualProfiles(
  lines: HistoryLine[],
  lookbackWeeks: number,
): ModelProfile[] {
  return (["income", "expense"] as ForecastType[]).flatMap((type) => {
    const matching = lines.filter((line) => line.type === type);
    if (matching.length === 0) return [];
    const weekdaySums = emptyWeekdays();
    let total = 0;
    for (const line of matching) {
      total += line.amount;
      const weekday = parseISO(line.date).getDay() as Weekday;
      weekdaySums[weekday] += line.amount;
    }
    return [{
      key: `${type}:residual`,
      label: "Residual history",
      type,
      weeklyAverage: total / lookbackWeeks,
      weekdayWeights: normalizeWeights(weekdaySums),
      historyLineIds: matching.map((line) => line.id),
    }];
  });
}

function projectProfiles(
  profiles: ModelProfile[],
  component: EstimateComponent,
  start: Date,
  endInclusive: Date,
): ForecastTx[] {
  const projected: ForecastTx[] = [];
  for (
    let day = startOfDay(start);
    day <= endInclusive;
    day = addDays(day, 1)
  ) {
    const weekday = day.getDay() as Weekday;
    for (const profile of profiles) {
      const amount =
        profile.weeklyAverage * profile.weekdayWeights[weekday];
      if (amount <= 0) continue;
      projected.push({
        id: `${component}:${profile.key}:${format(day, "yyyy-MM-dd")}`,
        date: day.toISOString(),
        amount,
        type: profile.type,
        category: profile.category,
        categoryId: profile.categoryId,
        description: `(Estimated) ${profile.label}`,
        source: "baseline",
        component,
      });
    }
  }
  return projected;
}

export function summarizeForecastTransactions(
  transactions: ForecastTx[],
): ForecastComponentSummary {
  const income = transactions.reduce(
    (total, transaction) =>
      transaction.type === "income" ? total + transaction.amount : total,
    0,
  );
  const expenses = transactions.reduce(
    (total, transaction) =>
      transaction.type === "expense" ? total + transaction.amount : total,
    0,
  );
  return {
    income,
    expenses,
    net: income - expenses,
    transactionCount: transactions.length,
  };
}

export function buildForwardForecast({
  transactions,
  recurringTransactions,
  recurringOccurrences = [],
  accounts,
  primaryAccountId,
  selectedAccountIds = [],
  forecastSettings,
  startDate,
  horizonDays = 90,
  lookbackWeeks = 26,
  minimumActiveWeeks = 4,
  reportingTimeZone = DEFAULT_REPORTING_TIME_ZONE,
}: BuildForwardForecastInput): ForwardForecastResult {
  if (!Number.isInteger(horizonDays) || horizonDays <= 0) {
    throw new Error("horizonDays must be a positive integer");
  }
  if (!Number.isInteger(lookbackWeeks) || lookbackWeeks <= 0) {
    throw new Error("lookbackWeeks must be a positive integer");
  }
  if (!Number.isInteger(minimumActiveWeeks) || minimumActiveWeeks <= 0) {
    throw new Error("minimumActiveWeeks must be a positive integer");
  }

  const start = startOfDay(startDate);
  const endInclusive = addDays(start, horizonDays - 1);
  const historyStartInclusive = addWeeks(start, -lookbackWeeks);
  const scopedTransactions = transactions.filter((transaction) =>
    isInAccountScope(
      transaction.accountId,
      selectedAccountIds,
      primaryAccountId,
    ),
  );
  const finalizedLines = financialReportingTransactions(scopedTransactions);
  const inHistoryWindow = finalizedLines.filter((transaction) => {
    const date = parseISO(transactionLedgerDate(transaction, reportingTimeZone));
    return date >= historyStartInclusive && date < start;
  });
  // A confirmed recurring actual remains authoritative ledger activity, but
  // its schedule owns the forward-looking estimate. Feeding that same actual
  // into a merchant/category model would project it a second time.
  const reconciledRecurringActuals = inHistoryWindow.filter(
    (transaction) => Boolean(transaction.recurringOccurrenceId),
  );
  const rawHistoryLines = inHistoryWindow
    .filter((transaction) => !transaction.recurringOccurrenceId)
    .map(toHistoryLine);

  const excludedCategories = new Set(
    (forecastSettings?.baselineExclusions?.categories ?? []).map((value) =>
      value.trim().toLocaleLowerCase(),
    ),
  );
  const excludedMerchants = new Set(
    forecastSettings?.baselineExclusions?.merchants ?? [],
  );
  const historicalActuals = rawHistoryLines.filter((line) => {
    const categoryName = (line.category ?? "Uncategorized")
      .trim()
      .toLocaleLowerCase();
    const categoryId = line.categoryId?.trim().toLocaleLowerCase();
    return (
      !excludedCategories.has(categoryName) &&
      (!categoryId || !excludedCategories.has(categoryId)) &&
      !excludedMerchants.has(line.merchantKey)
    );
  });

  // Partition the history. Each reporting line is owned by at most one model:
  // merchant first, then category, then one global residual per direction.
  const merchantProfiles = modelProfiles(
    historicalActuals,
    (line) => line.merchantKey === "unknown" ? null : line.merchantKey,
    (line) => normalizeMerchant(line.merchantName ?? line.description).merchantName,
    lookbackWeeks,
    minimumActiveWeeks,
  );
  const merchantCovered = new Set(
    merchantProfiles.flatMap((profile) => profile.historyLineIds),
  );
  const afterMerchant = historicalActuals.filter(
    (line) => !merchantCovered.has(line.id),
  );
  const categoryProfiles = modelProfiles(
    afterMerchant,
    (line) => line.categoryKey,
    (line) => line.category ?? "Uncategorized",
    lookbackWeeks,
    minimumActiveWeeks,
  );
  const categoryCovered = new Set(
    categoryProfiles.flatMap((profile) => profile.historyLineIds),
  );
  const residualHistory = afterMerchant.filter(
    (line) => !categoryCovered.has(line.id),
  );
  const fallbackProfiles = residualProfiles(residualHistory, lookbackWeeks);

  const visibleRecurring = recurringTransactions.filter((schedule) =>
    isInAccountScope(
      schedule.accountId,
      selectedAccountIds,
      primaryAccountId,
    ),
  );
  const generatedRecurring = expandRecurringBetween(
    visibleRecurring,
    start,
    endInclusive,
  );
  const occurrencesById = new Map(
    recurringOccurrences.map((occurrence) => [occurrence.id, occurrence]),
  );
  const representedOccurrenceIds = new Set<string>();
  const recurringFuture = generatedRecurring.flatMap((projected) => {
    const occurrenceId = projected.recurringOccurrenceId;
    if (!occurrenceId) return [projected];
    representedOccurrenceIds.add(occurrenceId);
    const occurrence = occurrencesById.get(occurrenceId);
    if (!occurrence) return [projected];
    if (
      occurrence.status === "fulfilled" ||
      occurrence.status === "skipped"
    ) return [];
    const remaining = Math.max(0, occurrence.remainingAmount);
    if (remaining <= 0) return [];
    return [{
      ...projected,
      amount: remaining,
      category: occurrence.category,
      categoryId: occurrence.categoryId,
      accountId: occurrence.accountId,
      description: `(Forecast) ${occurrence.description}`,
      originalDueDate: occurrence.originalDueDate,
      expectedAmount: occurrence.expectedAmount,
    }];
  });
  // Persisted occurrences survive schedule edits and deletion. If the schedule
  // no longer generates one, its original due-date snapshot still governs.
  for (const occurrence of recurringOccurrences) {
    if (representedOccurrenceIds.has(occurrence.id)) continue;
    if (
      occurrence.status === "fulfilled" ||
      occurrence.status === "skipped" ||
      occurrence.remainingAmount <= 0 ||
      !isInAccountScope(
        occurrence.accountId,
        selectedAccountIds,
        primaryAccountId,
      )
    ) continue;
    const dueDate = parseISO(occurrence.originalDueDate);
    if (dueDate < start || dueDate > endInclusive) continue;
    recurringFuture.push({
      id: `forecast_${occurrence.id}`,
      date: occurrence.originalDueDate,
      amount: occurrence.remainingAmount,
      type: occurrence.type,
      category: occurrence.category,
      categoryId: occurrence.categoryId,
      accountId: occurrence.accountId,
      description: `(Forecast) ${occurrence.description}`,
      source: "recurring",
      component: "scheduled",
      recurringOccurrenceId: occurrence.id,
      originalDueDate: occurrence.originalDueDate,
      expectedAmount: occurrence.expectedAmount,
    });
  }
  const merchantBaseline = projectProfiles(
    merchantProfiles,
    "merchant-estimate",
    start,
    endInclusive,
  );
  const categoryBaseline = projectProfiles(
    categoryProfiles,
    "category-estimate",
    start,
    endInclusive,
  );
  const residualBaseline = projectProfiles(
    fallbackProfiles,
    "residual-estimate",
    start,
    endInclusive,
  );
  const baseline = [
    ...merchantBaseline,
    ...categoryBaseline,
    ...residualBaseline,
  ];
  const forecastTransactions = [...recurringFuture, ...baseline];
  const totals = summarizeForecastTransactions(forecastTransactions);

  const scopedAccounts = selectedAccountIds.length === 0
    ? accounts
    : accounts.filter((account) => selectedAccountIds.includes(account.id));
  const openingBalance = scopedAccounts.reduce(
    (total, account) =>
      total + calculateAccountBalanceBefore(account, transactions, start),
    0,
  );

  const scheduled = summarizeForecastTransactions(recurringFuture);
  const merchantEstimated = summarizeForecastTransactions(merchantBaseline);
  const categoryEstimated = summarizeForecastTransactions(categoryBaseline);
  const residualEstimated = summarizeForecastTransactions(residualBaseline);

  return {
    contract: {
      start,
      endInclusive,
      horizonDays,
      historyStartInclusive,
      historyEndExclusive: start,
      lookbackWeeks,
      reportingTimeZone,
      includesToday: true,
    },
    series: buildForecastSeries(forecastTransactions, start, endInclusive),
    historicalActuals,
    recurringFuture,
    baseline,
    forecastTransactions,
    totals,
    openingBalance,
    projectedEndingBalance: openingBalance + totals.net,
    components: {
      scheduled,
      merchantEstimated,
      categoryEstimated,
      residualEstimated,
    },
    diagnostics: {
      fallbackUsed: residualBaseline.length > 0,
      // Explicit schedule expectations are removed by the canonical
      // financial predicate before this point. This legacy diagnostic remains
      // for API compatibility with the FIN-002 detail surface.
      excludedMaterializedRecurringLines: 0,
      excludedReconciledActualLines: reconciledRecurringActuals.length,
      merchantModelCount: merchantProfiles.length,
      categoryModelCount: categoryProfiles.length,
      residualHistoryLineCount: residualHistory.length,
      recurringOverlapNeedsReview:
        recurringOccurrences.some(
          (occurrence) => occurrence.status === "exception",
        ),
    },
    accountScope: {
      allAccounts: selectedAccountIds.length === 0,
      accountIds: [...selectedAccountIds],
    },
  };
}
