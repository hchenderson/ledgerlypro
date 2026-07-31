
'use client';

import {
  addDays, addWeeks, addMonths, addYears,
  isBefore, startOfDay, endOfDay,
  differenceInDays,
  parseISO, format, startOfWeek, isWithinInterval
} from 'date-fns';
import type { Transaction, RecurringTransaction } from '@/types';

export interface ForecastDataPoint {
  date: string; // MMM dd
  balance: number;
}

export interface Trajectory {
  slope: number; // percentage change
  period: string; // e.g., 'MoM', 'YoY'
}

export type WeeklyProfile = {
  weeklyIncomeAvg: number;
  weeklyExpenseAvg: number;
  weeklyIncomeSamples: number[];
  weeklyExpenseSamples: number[];
};

type ForecastPoint = {
  date: string; // ISO day
  income: number;
  expense: number;
  net: number;
  cumulativeNet: number;
};

function stepDate(d: Date, frequency: RecurringTransaction["frequency"]) {
  switch (frequency) {
    case "daily": return addDays(d, 1);
    case "weekly": return addWeeks(d, 1);
    case "monthly": return addMonths(d, 1);
    case "yearly": return addYears(d, 1);
  }
}

export function expandRecurringBetween(
  recurring: RecurringTransaction[],
  start: Date,
  end: Date
): Transaction[] {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  const out: Transaction[] = [];

  for (const rt of recurring) {
    const rtStart = startOfDay(parseISO(rt.startDate));

    // Anchor: start iterating from the later of rtStart or startDay
    let cursor = rtStart;
    while (isBefore(cursor, startDay)) {
      cursor = stepDate(cursor, rt.frequency);
    }

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


export function buildWeeklyProfile(actuals: Transaction[], lookbackWeeks = 13): WeeklyProfile {
  const today = startOfDay(new Date());
  const start = addWeeks(today, -lookbackWeeks);

  const windowTx = actuals.filter(t => {
    const d = parseISO(t.date);
    return isWithinInterval(d, { start, end: today }) && !t.description.startsWith("(Recurring)");
  });

  // bucket by week
  const weekMap = new Map<string, { income: number; expense: number }>();

  for (const t of windowTx) {
    const wk = startOfWeek(parseISO(t.date), { weekStartsOn: 1 }).toISOString();
    const prev = weekMap.get(wk) ?? { income: 0, expense: 0 };
    if (t.type === "income") prev.income += t.amount;
    else prev.expense += t.amount;
    weekMap.set(wk, prev);
  }

  const incomeSamples = Array.from(weekMap.values()).map(v => v.income);
  const expenseSamples = Array.from(weekMap.values()).map(v => v.expense);

  const avg = (xs: number[]) => xs.length ? xs.reduce((a,b)=>a+b,0) / xs.length : 0;

  return {
    weeklyIncomeAvg: avg(incomeSamples),
    weeklyExpenseAvg: avg(expenseSamples),
    weeklyIncomeSamples: incomeSamples,
    weeklyExpenseSamples: expenseSamples,
  };
}

export function projectWeeklyBaseline(
  profile: WeeklyProfile,
  start: Date,
  end: Date
): Transaction[] {
  // distribute weekly avg evenly per day (simple v1)
  const days = differenceInDays(end, start);
  const dailyIncome = profile.weeklyIncomeAvg / 7;
  const dailyExpense = profile.weeklyExpenseAvg / 7;

  const out: Transaction[] = [];
  for (let i=0; i<=days; i++) {
    const d = addDays(startOfDay(start), i);
    if (dailyIncome > 0) {
      out.push({
        id: `baseline_income_${d.toISOString()}`,
        date: d.toISOString(),
        amount: dailyIncome,
        type: "income",
        category: "Baseline",
        description: "(Baseline) Variable income",
        source: "baseline",
      });
    }
    if (dailyExpense > 0) {
      out.push({
        id: `baseline_expense_${d.toISOString()}`,
        date: d.toISOString(),
        amount: dailyExpense,
        type: "expense",
        category: "Baseline",
        description: "(Baseline) Variable expenses",
        source: "baseline",
      });
    }
  }
  return out;
}

export function buildForecastSeries(all: Transaction[], start: Date, end: Date): ForecastPoint[] {
  const dayKey = (iso: string) => iso.slice(0, 10); // YYYY-MM-DD
  const map = new Map<string, { income: number; expense: number }>();

  for (const t of all) {
    const k = dayKey(t.date);
    const prev = map.get(k) ?? { income: 0, expense: 0 };
    if (t.type === "income") prev.income += t.amount;
    else prev.expense += t.amount;
    map.set(k, prev);
  }

  // Walk days in range
  const points: ForecastPoint[] = [];
  let cumulativeNet = 0;

  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  for (let d = startDay; d <= endDay; d = addDays(d, 1)) {
    const k = d.toISOString().slice(0, 10);
    const v = map.get(k) ?? { income: 0, expense: 0 };
    const net = v.income - v.expense;
    cumulativeNet += net;
    points.push({
      date: d.toISOString(),
      income: v.income,
      expense: v.expense,
      net,
      cumulativeNet,
    });
  }

  return points;
}


export function generateForecast({
  recurringTransactions,
  historicalTransactions,
  currentBalance,
  days,
}: {
  recurringTransactions: RecurringTransaction[];
  historicalTransactions: Transaction[];
  currentBalance: number;
  days: number;
}): ForecastDataPoint[] {
  const startDate = startOfDay(new Date());
  const endDate = endOfDay(addDays(startDate, days - 1));

  // Step 1: Project scheduled transactions
  const scheduledTxs = expandRecurringBetween(recurringTransactions, startDate, endDate);

  // Step 2: Build profile and project variable baseline
  const weeklyProfile = buildWeeklyProfile(historicalTransactions);
  const baselineTxs = projectWeeklyBaseline(weeklyProfile, startDate, endDate);

  // Step 3: Combine and build the series
  const allForecastedTxs = [...scheduledTxs, ...baselineTxs];
  const forecastSeries = buildForecastSeries(allForecastedTxs, startDate, endDate);
  
  // Step 4: Convert to the format the chart expects
  return forecastSeries.map(point => ({
    date: format(parseISO(point.date), 'MMM dd'),
    balance: currentBalance + point.cumulativeNet
  }));
}
