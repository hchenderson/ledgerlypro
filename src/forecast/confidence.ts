
import { addWeeks, startOfDay, parseISO, isWithinInterval } from "date-fns";
import type { ForecastTx } from "./expandRecurringBetween";
import { quantiles } from "./stats";

function weekKeyMonday(iso: string) {
  const d = parseISO(iso);
  const monday = new Date(d);
  const day = monday.getDay();
  const diff = (day + 6) % 7;
  monday.setDate(monday.getDate() - diff);
  monday.setHours(0,0,0,0);
  return monday.toISOString();
}

function isActualVariable(t: ForecastTx) {
  return t.source === "actual" && !((t.description || "").startsWith("(Recurring)"));
}

export type WeeklyBandPoint = {
  weekStart: string;
  p25: number;
  p50: number;
  p75: number;
};

export function buildWeeklyNetBand(
  actuals: ForecastTx[],
  lookbackWeeks = 26
) {
  const today = startOfDay(new Date());
  const start = addWeeks(today, -lookbackWeeks);

  const inRange = actuals.filter(t => {
    const d = parseISO(t.date);
    return isActualVariable(t) && isWithinInterval(d, { start, end: today });
  });

  const byWeek = new Map<string, { income: number; expense: number }>();
  for (const t of inRange) {
    const wk = weekKeyMonday(t.date);
    const prev = byWeek.get(wk) ?? { income: 0, expense: 0 };
    if (t.type === "income") prev.income += t.amount;
    else prev.expense += t.amount;
    byWeek.set(wk, prev);
  }

  const nets = Array.from(byWeek.values()).map(v => v.income - v.expense);
  const [p25, p50, p75] = quantiles(nets, [0.25, 0.5, 0.75]);

  // For v1: a constant band applied to forecast weeks.
  // Next refinement: seasonality-aware bands per month-of-year.
  return { p25, p50, p75, weeklyNetSamples: nets };
}
