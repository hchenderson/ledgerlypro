
'use client';

import {
  addDays, addWeeks, addMonths, addYears,
  isAfter, isBefore, startOfDay, endOfDay,
  eachDayOfInterval, differenceInDays,
  parseISO, format
} from 'date-fns';
import type { Transaction, RecurringTransaction } from '@/types';

export interface ForecastDataPoint {
  date: string; // YYYY-MM-DD
  balance: number;
  netChange: number;
  scheduledIncome: number;
  scheduledExpense: number;
  variableIncome: number;
  variableExpense: number;
}

export interface Trajectory {
  slope: number; // percentage change
  period: string; // e.g., 'MoM', 'YoY'
}

/**
 * Projects future occurrences of recurring transactions within a given period.
 */
function projectRecurringTransactions(
  recurringTransactions: RecurringTransaction[],
  startDate: Date,
  endDate: Date
): Map<string, { income: number; expense: number }> {
  const projections = new Map<string, { income: number; expense: number }>();

  recurringTransactions.forEach(rt => {
    let nextDate = parseISO(rt.startDate);

    // Fast-forward to the start of the forecast period
    while (isBefore(nextDate, startDate)) {
      switch (rt.frequency) {
        case 'daily': nextDate = addDays(nextDate, 1); break;
        case 'weekly': nextDate = addWeeks(nextDate, 1); break;
        case 'monthly': nextDate = addMonths(nextDate, 1); break;
        case 'yearly': nextDate = addYears(nextDate, 1); break;
      }
    }
    
    // Add occurrences within the forecast period
    while (isBefore(nextDate, endDate) || nextDate.getTime() === endDate.getTime()) {
      const dateKey = format(nextDate, 'yyyy-MM-dd');
      const daily = projections.get(dateKey) || { income: 0, expense: 0 };
      
      if (rt.type === 'income') {
        daily.income += rt.amount;
      } else {
        daily.expense += rt.amount;
      }
      projections.set(dateKey, daily);

      switch (rt.frequency) {
        case 'daily': nextDate = addDays(nextDate, 1); break;
        case 'weekly': nextDate = addWeeks(nextDate, 1); break;
        case 'monthly': nextDate = addMonths(nextDate, 1); break;
        case 'yearly': nextDate = addYears(nextDate, 1); break;
      }
    }
  });

  return projections;
}

/**
 * Calculates the average daily variable income and expense from historical data.
 */
function calculateAverageVariableFlows(
  historicalTransactions: Transaction[],
  recurringTransactions: RecurringTransaction[]
): { avgDailyVariableIncome: number; avgDailyVariableExpense: number } {
  const recurringDescriptions = new Set(recurringTransactions.map(rt => `(Recurring) ${rt.description}`));
  
  const variableTransactions = historicalTransactions.filter(
    t => !recurringDescriptions.has(t.description)
  );

  if (variableTransactions.length === 0) {
    return { avgDailyVariableIncome: 0, avgDailyVariableExpense: 0 };
  }
  
  const sorted = variableTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const firstDate = startOfDay(new Date(sorted[0].date));
  const lastDate = endOfDay(new Date(sorted[sorted.length - 1].date));
  const totalDays = differenceInDays(lastDate, firstDate) + 1;
  
  if (totalDays <= 0) {
      return { avgDailyVariableIncome: 0, avgDailyVariableExpense: 0 };
  }
  
  const totals = variableTransactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  return {
    avgDailyVariableIncome: totals.income / totalDays,
    avgDailyVariableExpense: totals.expense / totalDays,
  };
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

  const scheduledFlows = projectRecurringTransactions(recurringTransactions, startDate, endDate);
  const { avgDailyVariableIncome, avgDailyVariableExpense } = calculateAverageVariableFlows(historicalTransactions, recurringTransactions);

  const forecast: ForecastDataPoint[] = [];
  let runningBalance = currentBalance;

  const interval = eachDayOfInterval({ start: startDate, end: endDate });

  for (const day of interval) {
    const dateKey = format(day, 'yyyy-MM-dd');
    const scheduled = scheduledFlows.get(dateKey) || { income: 0, expense: 0 };
    
    const netChange = 
      scheduled.income - scheduled.expense +
      avgDailyVariableIncome - avgDailyVariableExpense;
      
    runningBalance += netChange;

    forecast.push({
      date: format(day, 'MMM dd'), // format for chart
      balance: runningBalance,
      netChange,
      scheduledIncome: scheduled.income,
      scheduledExpense: scheduled.expense,
      variableIncome: avgDailyVariableIncome,
      variableExpense: avgDailyVariableExpense,
    });
  }

  return forecast;
}
