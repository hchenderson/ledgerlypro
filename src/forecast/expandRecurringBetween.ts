import { startOfDay } from "date-fns";
import {
  recurringOccurrenceDatesBetween,
  recurringOccurrenceId,
} from "@/lib/recurring";
import { minorToMajor, moneyMinor } from "@/lib/money";

// Keep this small and compatible with your existing data
export type ForecastTxType = "income" | "expense";

export type ForecastTx = {
  id: string;
  date: string; // ISO
  amount: number;
  amountMinor?: number;
  currency?: string;
  type: ForecastTxType;
  category?: string;
  categoryId?: string;
  accountId?: string;
  merchantName?: string;
  description?: string;
  source: "recurring" | "baseline" | "actual";
  component?:
    | "scheduled"
    | "merchant-estimate"
    | "category-estimate"
    | "residual-estimate";
  recurringOccurrenceId?: string;
  originalDueDate?: string;
  expectedAmount?: number;
};

export type RecurringTxLike = {
  id: string;
  startDate: string; // ISO
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  amount: number;
  type: ForecastTxType;
  category: string;
  categoryId?: string;
  accountId?: string;
  description: string;
};

export function expandRecurringBetween(
  recurring: RecurringTxLike[],
  start: Date,
  end: Date
): ForecastTx[] {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  const out: ForecastTx[] = [];

  for (const rt of recurring) {
    for (const dueDate of recurringOccurrenceDatesBetween(rt, startDay, endDay)) {
      const localDueDate = new Date(
        dueDate.getUTCFullYear(),
        dueDate.getUTCMonth(),
        dueDate.getUTCDate(),
      );
      out.push({
        id: `forecast_${recurringOccurrenceId(rt.id, dueDate)}`,
        date: localDueDate.toISOString(),
        amount: minorToMajor(moneyMinor(rt)),
        type: rt.type,
        category: rt.category,
        categoryId: rt.categoryId,
        accountId: rt.accountId,
        description: `(Forecast) ${rt.description}`,
        source: "recurring",
        component: "scheduled",
        recurringOccurrenceId: recurringOccurrenceId(rt.id, dueDate),
        originalDueDate: dueDate.toISOString(),
        expectedAmount: minorToMajor(moneyMinor(rt)),
      });
    }
  }

  return out;
}
