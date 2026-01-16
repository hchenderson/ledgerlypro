
import { addWeeks, startOfDay, parseISO, isWithinInterval } from "date-fns";
import type { ForecastTx } from "./expandRecurringBetween";

export type WeeklyProfile = {
  weeklyIncomeAvg: number;
  weeklyExpenseAvg: number;
  weeklyIncomeSamples: number[];
  weeklyExpenseSamples: number[];
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function buildWeeklyProfile(actuals: ForecastTx[], lookbackWeeks = 13): WeeklyProfile {
  const today = startOfDay(new Date());
  const start = addWeeks(today, -lookbackWeeks);

  const windowTx = actuals.filter((t) => {
    const d = parseISO(t.date);
    return (
      t.source === "actual" &&
      isWithinInterval(d, { start, end: today }) &&
      // exclude recurring-materialized transactions (your app uses "(Recurring)" prefix)
      !(t.description || "").startsWith("(Recurring)")
    );
  });

  // Bucket by week start (Mon)
  const weekKey = (iso: string) => {
    const d = parseISO(iso);
    // simple ISO week key: YYYY-WW via Monday-based week start approximation
    // (good enough for v1; can refine later)
    const monday = new Date(d);
    const day = monday.getDay(); // 0 Sun ... 6 Sat
    const diff = (day + 6) % 7; // days since Monday
    monday.setDate(monday.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  };

  const weekMap = new Map<string, { income: number; expense: number }>();

  for (const t of windowTx) {
    const k = weekKey(t.date);
    const prev = weekMap.get(k) ?? { income: 0, expense: 0 };
    if (t.type === "income") prev.income += t.amount;
    else prev.expense += t.amount;
    weekMap.set(k, prev);
  }

  const incomeSamples = Array.from(weekMap.values()).map((v) => v.income);
  const expenseSamples = Array.from(weekMap.values()).map((v) => v.expense);

  return {
    weeklyIncomeAvg: avg(incomeSamples),
    weeklyExpenseAvg: avg(expenseSamples),
    weeklyIncomeSamples: incomeSamples,
    weeklyExpenseSamples: expenseSamples,
  };
}

export function projectWeeklyBaselineEvenDaily(
  profile: WeeklyProfile,
  start: Date,
  end: Date
): ForecastTx[] {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);

  const dailyIncome = profile.weeklyIncomeAvg / 7;
  const dailyExpense = profile.weeklyExpenseAvg / 7;

  const out: ForecastTx[] = [];

  for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
    const iso = new Date(d).toISOString();

    out.push({
      id: `baseline_income_${iso}`,
      date: iso,
      amount: dailyIncome,
      type: "income",
      description: "(Baseline) Variable income",
      source: "baseline",
    });

    out.push({
      id: `baseline_expense_${iso}`,
      date: iso,
      amount: dailyExpense,
      type: "expense",
      description: "(Baseline) Variable expenses",
      source: "baseline",
    });
  }

  return out;
}
