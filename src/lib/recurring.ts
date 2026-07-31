import type { RecurringTransaction, Transaction } from "@/types";

export interface PlannedRecurringOccurrence extends Transaction {
  recurringTransactionId: string;
}

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

export function recurringOccurrenceId(recurringId: string, date: Date): string {
  return `${recurringId}_${date.toISOString().slice(0, 10)}`;
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
    const date = cursor.toISOString();
    occurrences.push({
      id: recurringOccurrenceId(recurring.id, cursor),
      recurringTransactionId: recurring.id,
      date,
      description: `(Recurring) ${recurring.description}`,
      amount: Math.abs(recurring.amount),
      type: recurring.type,
      category: recurring.category,
      ...(recurring.categoryId ? { categoryId: recurring.categoryId } : {}),
      ...(recurring.accountId
        ? { accountId: recurring.accountId }
        : {}),
      source: "recurring",
    });
    cursor = nextOccurrence(cursor, recurring.frequency, anchorDay, anchorMonth);
  }

  return {
    occurrences,
    hasMore: cursor.getTime() <= through.getTime(),
    lastAddedDate: occurrences.at(-1)?.date,
  };
}
