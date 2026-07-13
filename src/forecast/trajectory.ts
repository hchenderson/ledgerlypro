
import { addWeeks, startOfDay, parseISO, isWithinInterval } from "date-fns";
import type { ForecastTx } from "./expandRecurringBetween";

export type TrajectoryPoint = {
  weekStart: string; // ISO
  total: number;
  rolling4wk: number;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function weekKeyMonday(iso: string) {
  const d = parseISO(iso);
  const monday = new Date(d);
  const day = monday.getDay();
  const diff = (day + 6) % 7;
  monday.setDate(monday.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

export function buildWeeklyTrajectory(
  actuals: ForecastTx[],
  lookbackWeeks = 26,
  filter?: {
    type: "income" | "expense";
    categories?: string[]; // if set, only include those categories
    excludeRecurringPrefixed?: boolean; // default true
  }
) {
  const today = startOfDay(new Date());
  const start = addWeeks(today, -lookbackWeeks);

  const catSet = filter?.categories?.length ? new Set(filter.categories.map((c) => c.trim())) : null;

  const txs = actuals.filter((t) => {
    const d = parseISO(t.date);
    if (t.source !== "actual") return false;
    if (filter?.excludeRecurringPrefixed !== false && (t.description || "").startsWith("(Recurring)")) return false;
    if (!isWithinInterval(d, { start, end: today })) return false;
    if (t.type !== filter?.type) return false;
    if (catSet && !catSet.has((t.category || "Uncategorized").trim())) return false;
    return true;
  });

  const byWeek = new Map<string, number>();
  for (const t of txs) {
    const wk = weekKeyMonday(t.date);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + t.amount);
  }

  const weeks = Array.from(byWeek.keys()).sort();
  const totals = weeks.map((w) => byWeek.get(w) ?? 0);

  const points: TrajectoryPoint[] = weeks.map((w, idx) => {
    const slice = totals.slice(Math.max(0, idx - 3), idx + 1); // last 4 including current
    return { weekStart: w, total: totals[idx], rolling4wk: avg(slice) };
  });

  const last4 = totals.slice(-4);
  const prev4 = totals.slice(-8, -4);
  const delta = avg(last4) - avg(prev4);

  return { points, last4wkAvg: avg(last4), prev4wkAvg: avg(prev4), delta };
}
