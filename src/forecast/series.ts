import { addDays, startOfDay, parseISO } from "date-fns";
import type { ForecastTx } from "./expandRecurringBetween";

export type ForecastPoint = {
  date: string; // ISO day
  income: number;
  expense: number;
  net: number;
  cumulativeNet: number;
};

export function buildForecastSeries(txs: ForecastTx[], start: Date, end: Date): ForecastPoint[] {
  const dayKey = (iso: string) => iso.slice(0, 10); // YYYY-MM-DD

  const buckets = new Map<string, { income: number; expense: number }>();

  for (const t of txs) {
    const k = dayKey(t.date);
    const prev = buckets.get(k) ?? { income: 0, expense: 0 };
    if (t.type === "income") prev.income += t.amount;
    else prev.expense += t.amount;
    buckets.set(k, prev);
  }

  const points: ForecastPoint[] = [];
  let cumulativeNet = 0;

  const startDay = startOfDay(start);
  const endDay = startOfDay(end);

  for (let d = startDay; d <= endDay; d = addDays(d, 1)) {
    const iso = d.toISOString();
    const k = dayKey(iso);
    const v = buckets.get(k) ?? { income: 0, expense: 0 };
    const net = v.income - v.expense;
    cumulativeNet += net;

    points.push({
      date: iso,
      income: v.income,
      expense: v.expense,
      net,
      cumulativeNet,
    });
  }

  return points;
}

export function sumBetween(txs: ForecastTx[], start: Date, end: Date, type: "income" | "expense") {
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  return txs.reduce((acc, t) => {
    const d = startOfDay(parseISO(t.date)).getTime();
    if (d >= s && d <= e && t.type === type) return acc + t.amount;
    return acc;
  }, 0);
}
