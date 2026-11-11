import type {
  RecurringOccurrence,
  RecurringTransaction,
  Transaction,
} from "@/types";
import { minorToMajor, moneyMinor } from "@/lib/money";

export type PlannedRecurringOccurrence = RecurringOccurrence;

export interface RecurringOccurrencePlan {
  occurrences: PlannedRecurringOccurrence[];
  hasMore: boolean;
  lastAddedDate?: string;
}

function nextOccurrence(
  date: Date,
  frequency: RecurringTransaction["frequency"],
  anchorDay: number,
  anchorMonth: number
): Date {
  switch (frequency) {
    case "daily":
      return new Date(date.getTime() + 86_400_000);
    case "weekly":
      return new Date(date.getTime() + 7 * 86_400_000);
    case "monthly": { 
      const firstOfTargetMonth = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
      );
      const lastDay = new Date(
        Date.UTC(
          firstOfTargetMonth.getUTCFullYear(),
          firstOfTargetMonth.getUTCMonth() + 1,
          0
        )
      ).getUTCDate();
      return new Date(
        Date.UTC(
          firstOfTargetMonth.getUTCFullYear(),
          firstOfTargetMonth.getUTCMonth(),
          Math.min(anchorDay, lastDay)
        )
      );
    }
    case "yearly": {
      const targetYear = date.getUTCFullYear() + 1;
      const lastDay = new Date(
        Date.UTC(targetYear, anchorMonth + 1, 0)
      ).getUTCDate();
      return new Date(
        Date.UTC(targetYear, anchorMonth, Math.min(anchorDay, lastDay))
      );
    }
  }
}

function toUtcCalendarDay(value: string | Date): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return new Date(Number.NaN);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function localBoundaryAsUtcCalendarDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
  );
}

export function recurringOccurrenceId(recurringId: string, date: Date): string {
  return `${recurringId}_${date.toISOString().slice(0, 10)}`;
}

/** Enumerates schedule calendar dates without consulting lastAddedDate. The
 * process route uses lastAddedDate for write batching; forecasts need the full
 * schedule in their requested window. Both paths share the same month-end and
 * leap-year anchoring rules so occurrence identities remain identical. */
export function recurringOccurrenceDatesBetween(
  recurring: Pick<RecurringTransaction, "startDate" | "frequency">,
  from: Date,
  through: Date,
): Date[] {
  const startDate = toUtcCalendarDay(recurring.startDate);
  const fromDate = localBoundaryAsUtcCalendarDay(from);
  const throughDate = localBoundaryAsUtcCalendarDay(through);
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(throughDate.getTime())
  ) return [];

  const anchorDay = startDate.getUTCDate();
  const anchorMonth = startDate.getUTCMonth();
  let cursor = startDate;
  while (cursor < fromDate) {
    cursor = nextOccurrence(
      cursor,
      recurring.frequency,
      anchorDay,
      anchorMonth,
    );
  }
  const dates: Date[] = [];
  while (cursor <= throughDate) {
    dates.push(cursor);
    cursor = nextOccurrence(
      cursor,
      recurring.frequency,
      anchorDay,
      anchorMonth,
    );
  }
  return dates;
}

export function recurringOccurrenceFromSchedule(
  recurring: RecurringTransaction,
  dueDate: Date,
  now = new Date().toISOString(),
): RecurringOccurrence {
  const originalDueDate = toUtcCalendarDay(dueDate).toISOString();
  const expectedAmountMinor = moneyMinor(recurring);
  const expectedAmount = minorToMajor(expectedAmountMinor);
  return {
    id: recurringOccurrenceId(recurring.id, dueDate),
    recurringTransactionId: recurring.id,
    originalDueDate,
    expectedAmount,
    expectedAmountMinor,
    remainingAmount: expectedAmount,
    remainingAmountMinor: expectedAmountMinor,
    matchedAmount: 0,
    matchedAmountMinor: 0,
    varianceAmount: 0,
    varianceAmountMinor: 0,
    type: recurring.type,
    category: recurring.category,
    ...(recurring.categoryId ? { categoryId: recurring.categoryId } : {}),
    ...(recurring.accountId ? { accountId: recurring.accountId } : {}),
    ...(recurring.envelopeId ? { envelopeId: recurring.envelopeId } : {}),
    description: recurring.description,
    status: "expected",
    matches: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function recurringOccurrenceFromLegacyTransaction(
  transaction: Transaction,
  now = new Date().toISOString(),
): RecurringOccurrence | null {
  if (
    transaction.source !== "recurring" ||
    !transaction.recurringTransactionId
  ) return null;
  const dueDate = toUtcCalendarDay(transaction.date);
  if (Number.isNaN(dueDate.getTime())) return null;
  const expectedAmountMinor = moneyMinor(transaction);
  const expectedAmount = minorToMajor(expectedAmountMinor);
  return {
    id: recurringOccurrenceId(transaction.recurringTransactionId, dueDate),
    recurringTransactionId: transaction.recurringTransactionId,
    originalDueDate: dueDate.toISOString(),
    expectedAmount,
    expectedAmountMinor,
    remainingAmount: expectedAmount,
    remainingAmountMinor: expectedAmountMinor,
    matchedAmount: 0,
    matchedAmountMinor: 0,
    varianceAmount: 0,
    varianceAmountMinor: 0,
    type: transaction.type === "income" ? "income" : "expense",
    category: transaction.category,
    ...(transaction.categoryId ? { categoryId: transaction.categoryId } : {}),
    ...(transaction.accountId ? { accountId: transaction.accountId } : {}),
    ...(transaction.envelopeId ? { envelopeId: transaction.envelopeId } : {}),
    description: transaction.description.replace(/^\(Recurring\)\s*/, ""),
    status: "expected",
    matches: [],
    legacyTransactionId: transaction.id,
    createdAt: now,
    updatedAt: now,
  };
}

export function planRecurringOccurrences(
  recurring: RecurringTransaction,
  throughDate: Date,
  limit = 400
): RecurringOccurrencePlan {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("limit must be a positive integer");
  }

  const startDate = toUtcCalendarDay(recurring.startDate);
  const through = toUtcCalendarDay(throughDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(through.getTime())) {
    throw new Error("Recurring transaction contains an invalid date");
  }

  const anchorDay = startDate.getUTCDate();
  const anchorMonth = startDate.getUTCMonth();
  let cursor = recurring.lastAddedDate
    ? nextOccurrence(
        toUtcCalendarDay(recurring.lastAddedDate),
        recurring.frequency,
        anchorDay,
        anchorMonth
      )
    : startDate;
  const occurrences: PlannedRecurringOccurrence[] = [];

  while (cursor.getTime() <= through.getTime() && occurrences.length < limit) {
    occurrences.push(recurringOccurrenceFromSchedule(recurring, cursor));
    cursor = nextOccurrence(cursor, recurring.frequency, anchorDay, anchorMonth);
  }

  return {
    occurrences,
    hasMore: cursor.getTime() <= through.getTime(),
    lastAddedDate: occurrences.at(-1)?.originalDueDate,
  };
}
