import { addDays, addWeeks, addMonths, addYears, isBefore, startOfDay, parseISO } from "date-fns";

// Keep this small and compatible with your existing data
export type ForecastTxType = "income" | "expense";

export type ForecastTx = {
  id: string;
  date: string; // ISO
  amount: number;
  type: ForecastTxType;
  category?: string;
  description?: string;
  source: "recurring" | "baseline" | "actual";
};

export type RecurringTxLike = {
  id: string;
  startDate: string; // ISO
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  amount: number;
  type: ForecastTxType;
  category: string;
  description: string;
};

function stepDate(d: Date, frequency: RecurringTxLike["frequency"]) {
  switch (frequency) {
    case "daily":
      return addDays(d, 1);
    case "weekly":
      return addWeeks(d, 1);
    case "monthly":
      return addMonths(d, 1);
    case "yearly":
      return addYears(d, 1);
  }
}

export function expandRecurringBetween(
  recurring: RecurringTxLike[],
  start: Date,
  end: Date
): ForecastTx[] {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  const out: ForecastTx[] = [];

  for (const rt of recurring) {
    const rtStart = startOfDay(parseISO(rt.startDate));

    // Advance cursor to first occurrence on/after startDay
    let cursor = rtStart;
    while (isBefore(cursor, startDay)) {
      cursor = stepDate(cursor, rt.frequency);
    }

    // Emit occurrences through endDay (inclusive)
    while (isBefore(cursor, endDay) || cursor.getTime() === endDay.getTime()) {
      out.push({
        id: `forecast_${rt.id}_${cursor.toISOString()}`,
        date: cursor.toISOString(),
        amount: rt.amount,
        type: rt.type,
        category: rt.category,
        description: `(Forecast) ${rt.description}`,
        source: "recurring",
      });
      cursor = stepDate(cursor, rt.frequency);
    }
  }

  return out;
}
