import { isFinancialTransaction } from "@/lib/accounts";
import { normalizeMerchant } from "@/forecast/merchant-normalize";
import type {
  RecurringOccurrence,
  RecurringOccurrenceMatch,
  Transaction,
} from "@/types";
import { minorToMajor, moneyMinor } from "@/lib/money";

export const RECURRING_MATCH_EARLY_DAYS = 5;
export const RECURRING_MATCH_LATE_DAYS = 7;

export interface RecurringMatchCandidate {
  occurrenceId: string;
  transactionId: string;
  score: number;
  dayDifference: number;
  amountDifference: number;
  reasons: string[];
  ambiguous: boolean;
}

export interface RecurringMatchOptions {
  primaryAccountId?: string | null;
  earlyDays?: number;
  lateDays?: number;
}

function resolvedAccountId(
  accountId: string | undefined,
  primaryAccountId?: string | null,
) {
  return accountId ?? primaryAccountId ?? "";
}

function activeMatches(occurrence: RecurringOccurrence) {
  return occurrence.matches.filter((match) => match.status === "confirmed");
}

function totalMatchedMinor(matches: RecurringOccurrenceMatch[]) {
  return matches
    .filter((match) => match.status === "confirmed")
    .reduce((total, match) => total + moneyMinor(match), 0);
}

function utcCalendarDayNumber(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) /
    86_400_000;
}

function withRecalculatedMatchState(
  occurrence: RecurringOccurrence,
  matches: RecurringOccurrenceMatch[],
  updatedAt: string,
): RecurringOccurrence {
  const expectedAmountMinor = occurrence.expectedAmountMinor ?? moneyMinor({ amount: occurrence.expectedAmount });
  const matchedAmountMinor = totalMatchedMinor(matches);
  const remainingAmountMinor = Math.max(0, expectedAmountMinor - matchedAmountMinor);
  const varianceAmountMinor = Math.max(0, matchedAmountMinor - expectedAmountMinor);
  const matchedAmount = minorToMajor(matchedAmountMinor);
  const remainingAmount = minorToMajor(remainingAmountMinor);
  return {
    ...occurrence,
    matches,
    matchedAmount,
    matchedAmountMinor,
    remainingAmount,
    remainingAmountMinor,
    varianceAmount: minorToMajor(varianceAmountMinor),
    varianceAmountMinor,
    status:
      matchedAmount <= 0
        ? "expected"
        : remainingAmount > 0
          ? "partially-fulfilled"
          : "fulfilled",
    exceptionReason: undefined,
    skippedAt: undefined,
    updatedAt,
  };
}

export function isEligibleRecurringActual(transaction: Transaction) {
  return (
    isFinancialTransaction(transaction) &&
    transaction.source !== "recurring" &&
    !transaction.recurringExpectationOnly
  );
}

export function buildRecurringMatchCandidates(
  occurrences: RecurringOccurrence[],
  transactions: Transaction[],
  options: RecurringMatchOptions = {},
): RecurringMatchCandidate[] {
  const earlyDays = options.earlyDays ?? RECURRING_MATCH_EARLY_DAYS;
  const lateDays = options.lateDays ?? RECURRING_MATCH_LATE_DAYS;
  const uniqueTransactions = new Map(
    transactions.map((transaction) => [transaction.id, transaction]),
  );
  const candidates: RecurringMatchCandidate[] = [];

  for (const occurrence of occurrences) {
    if (
      occurrence.status === "fulfilled" ||
      occurrence.status === "skipped"
    ) continue;
    const dueDay = utcCalendarDayNumber(occurrence.originalDueDate);
    if (!Number.isFinite(dueDay)) continue;
    const dismissed = new Set(occurrence.dismissedTransactionIds ?? []);
    const remainingAmount = minorToMajor(
      occurrence.remainingAmountMinor ?? moneyMinor({ amount: occurrence.remainingAmount ?? occurrence.expectedAmount }),
    );
    const expectedMerchant = normalizeMerchant(occurrence.description);

    for (const transaction of uniqueTransactions.values()) {
      if (!isEligibleRecurringActual(transaction)) continue;
      if (dismissed.has(transaction.id)) continue;
      if (
        transaction.recurringOccurrenceId &&
        transaction.recurringOccurrenceId !== occurrence.id
      ) continue;
      if (transaction.type !== occurrence.type) continue;
      if (
        resolvedAccountId(transaction.accountId, options.primaryAccountId) !==
        resolvedAccountId(occurrence.accountId, options.primaryAccountId)
      ) continue;

      const postingDay = utcCalendarDayNumber(transaction.date);
      if (!Number.isFinite(postingDay)) continue;
      const dayDifference = postingDay - dueDay;
      if (dayDifference < -earlyDays || dayDifference > lateDays) continue;

      const amountDifference = Math.abs(
        minorToMajor(moneyMinor(transaction)) - remainingAmount,
      );
      const tolerance = Math.max(5, remainingAmount * 0.1);
      const amountWithinTolerance = amountDifference <= tolerance;
      const actualMerchant = normalizeMerchant(
        transaction.merchantName ?? transaction.description,
      );
      const merchantMatches =
        expectedMerchant.merchantKey !== "unknown" &&
        actualMerchant.merchantKey === expectedMerchant.merchantKey;
      const isPartial =
        moneyMinor(transaction) > 0 &&
        minorToMajor(moneyMinor(transaction)) < remainingAmount;
      if (!amountWithinTolerance && !(merchantMatches && isPartial)) {
        if (!merchantMatches) continue;
      }

      const reasons = [
        "same account",
        `same ${occurrence.type} direction`,
        dayDifference === 0
          ? "posted on the due date"
          : `${Math.abs(dayDifference)} day${Math.abs(dayDifference) === 1 ? "" : "s"} ${dayDifference < 0 ? "early" : "late"}`,
      ];
      if (amountWithinTolerance) reasons.push("amount within tolerance");
      else if (isPartial) reasons.push("possible partial payment");
      else reasons.push("changed amount");
      if (merchantMatches) reasons.push("merchant matches");

      candidates.push({
        occurrenceId: occurrence.id,
        transactionId: transaction.id,
        score:
          40 +
          (amountWithinTolerance ? 25 : 0) +
          (merchantMatches ? 20 : 0) +
          Math.max(0, 15 - Math.abs(dayDifference) * 2),
        dayDifference,
        amountDifference,
        reasons,
        ambiguous: false,
      });
    }
  }

  const counts = new Map<string, number>();
  candidates.forEach((candidate) => {
    counts.set(
      candidate.occurrenceId,
      (counts.get(candidate.occurrenceId) ?? 0) + 1,
    );
  });
  return candidates
    .map((candidate) => ({
      ...candidate,
      ambiguous: (counts.get(candidate.occurrenceId) ?? 0) > 1,
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.transactionId.localeCompare(right.transactionId),
    );
}

export function confirmRecurringMatch(
  occurrence: RecurringOccurrence,
  transaction: Transaction,
  confirmedAt: string,
): RecurringOccurrence {
  if (!isEligibleRecurringActual(transaction)) {
    throw new Error("Only a finalized financial transaction can fulfill an occurrence.");
  }
  if (occurrence.status === "skipped") {
    throw new Error("A skipped occurrence must be restored before it can be matched.");
  }
  if (
    transaction.recurringOccurrenceId &&
    transaction.recurringOccurrenceId !== occurrence.id
  ) {
    throw new Error("This transaction already fulfills another occurrence.");
  }
  if (
    occurrence.matches.some(
      (match) =>
        match.transactionId === transaction.id &&
        match.status === "confirmed",
    )
  ) return occurrence;

  const matches = [
    ...occurrence.matches.filter(
      (match) => match.transactionId !== transaction.id,
    ),
    {
      transactionId: transaction.id,
      amount: minorToMajor(moneyMinor(transaction)),
      amountMinor: moneyMinor(transaction),
      postingDate: transaction.date,
      confirmedAt,
      status: "confirmed" as const,
    },
  ];
  return withRecalculatedMatchState(occurrence, matches, confirmedAt);
}

export function unlinkRecurringMatch(
  occurrence: RecurringOccurrence,
  transactionId: string,
  updatedAt: string,
) {
  if (!occurrence.matches.some((match) => match.transactionId === transactionId)) {
    return occurrence;
  }
  return withRecalculatedMatchState(
    occurrence,
    occurrence.matches.filter(
      (match) => match.transactionId !== transactionId,
    ),
    updatedAt,
  );
}

export function refreshRecurringMatch(
  occurrence: RecurringOccurrence,
  transaction: Transaction,
  updatedAt: string,
) {
  const existing = occurrence.matches.find(
    (match) => match.transactionId === transaction.id,
  );
  if (!existing || existing.status !== "confirmed") return occurrence;
  return withRecalculatedMatchState(
    occurrence,
    occurrence.matches.map((match) =>
      match.transactionId === transaction.id
        ? {
            ...match,
            amount: minorToMajor(moneyMinor(transaction)),
            amountMinor: moneyMinor(transaction),
            postingDate: transaction.date,
          }
        : match,
    ),
    updatedAt,
  );
}

export function invalidateRecurringMatch(
  occurrence: RecurringOccurrence,
  transactionId: string,
  reason: string,
  invalidatedAt: string,
) {
  const matches = occurrence.matches.map((match) =>
    match.transactionId === transactionId && match.status === "confirmed"
      ? {
          ...match,
          status: "invalidated" as const,
          invalidatedAt,
          invalidationReason: reason,
        }
      : match,
  );
  const matchedAmountMinor = totalMatchedMinor(matches);
  const expectedAmountMinor = occurrence.expectedAmountMinor ?? moneyMinor({ amount: occurrence.expectedAmount });
  const matchedAmount = minorToMajor(matchedAmountMinor);
  const remainingAmountMinor = Math.max(0, expectedAmountMinor - matchedAmountMinor);
  const varianceAmountMinor = Math.max(0, matchedAmountMinor - expectedAmountMinor);
  return {
    ...occurrence,
    matches,
    matchedAmount,
    matchedAmountMinor,
    remainingAmount: minorToMajor(remainingAmountMinor),
    remainingAmountMinor,
    varianceAmount: minorToMajor(varianceAmountMinor),
    varianceAmountMinor,
    status: "exception" as const,
    exceptionReason: reason,
    updatedAt: invalidatedAt,
  };
}

export function skipRecurringOccurrence(
  occurrence: RecurringOccurrence,
  skippedAt: string,
) {
  if (activeMatches(occurrence).length > 0) {
    throw new Error("Unlink confirmed transactions before skipping this occurrence.");
  }
  return {
    ...occurrence,
    status: "skipped" as const,
    skippedAt,
    exceptionReason: undefined,
    updatedAt: skippedAt,
  };
}

export function dismissRecurringCandidate(
  occurrence: RecurringOccurrence,
  transactionId: string,
  updatedAt: string,
) {
  return {
    ...occurrence,
    dismissedTransactionIds: [
      ...new Set([
        ...(occurrence.dismissedTransactionIds ?? []),
        transactionId,
      ]),
    ],
    updatedAt,
  };
}

export function undoDismissRecurringCandidate(
  occurrence: RecurringOccurrence,
  transactionId: string,
  updatedAt: string,
) {
  return {
    ...occurrence,
    dismissedTransactionIds: (occurrence.dismissedTransactionIds ?? []).filter(
      (id) => id !== transactionId,
    ),
    updatedAt,
  };
}
