'use server';
/**
 * @fileOverview A flow for calculating and returning dashboard analytics.
 *
 * - getDashboardAnalytics - A function that handles the dashboard analytics process.
 * - GetDashboardAnalyticsInput - The input type for the getDashboardAnalytics function.
 * - GetDashboardAnalyticsOutput - The return type for the getDashboardAnalytics function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetDashboardAnalyticsInputSchema = z.object({
  transactions: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        description: z.string(),
        amount: z.number(),
        type: z.enum(['income', 'expense']),
        category: z.string(),
      })
    )
    .describe('An array of user transactions.'),
  startingBalance: z.number().describe('The user\'s starting balance.'),
});
export type GetDashboardAnalyticsInput = z.infer<
  typeof GetDashboardAnalyticsInputSchema
>;

const GetDashboardAnalyticsOutputSchema = z.object({
  totalIncome: z.number(),
  totalExpenses: z.number(),
  currentBalance: z.number(),
  overviewData: z.array(
    z.object({
      name: z.string(),
      income: z.number(),
      expense: z.number(),
    })
  ),
  currentMonthIncome: z.number(),
  currentMonthExpenses: z.number(),
  previousMonthIncome: z.number(),
  previousMonthExpenses: z.number(),
  savingsRate: z.number(),
});
export type GetDashboardAnalyticsOutput = z.infer<
  typeof GetDashboardAnalyticsOutputSchema
>;

export async function getDashboardAnalytics(
  input: GetDashboardAnalyticsInput
): Promise<GetDashboardAnalyticsOutput> {
  return getDashboardAnalyticsFlow(input);
}

const getDashboardAnalyticsFlow = ai.defineFlow(
  {
    name: 'getDashboardAnalyticsFlow',
    inputSchema: GetDashboardAnalyticsInputSchema,
    outputSchema: GetDashboardAnalyticsOutputSchema,
  },
  async ({transactions, startingBalance}) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevMonthYear = prevMonth === 11 ? now.getFullYear() - 1 : now.getFullYear();

    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const currentMonthIncome = transactions
      .filter(t => {
        const transactionDate = new Date(t.date);
        return (
          t.type === 'income' &&
          transactionDate.getMonth() === currentMonth &&
          transactionDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const currentMonthExpenses = transactions
      .filter(t => {
        const transactionDate = new Date(t.date);
        return (
          t.type === 'expense' &&
          transactionDate.getMonth() === currentMonth &&
          transactionDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, t) => sum + t.amount, 0);
      
    const previousMonthIncome = transactions
      .filter(t => {
        const transactionDate = new Date(t.date);
        return (
          t.type === 'income' &&
          transactionDate.getMonth() === prevMonth &&
          transactionDate.getFullYear() === prevMonthYear
        );
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const previousMonthExpenses = transactions
      .filter(t => {
        const transactionDate = new Date(t.date);
        return (
          t.type === 'expense' &&
          transactionDate.getMonth() === prevMonth &&
          transactionDate.getFullYear() === prevMonthYear
        );
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const currentBalance = startingBalance + totalIncome - totalExpenses;

    const monthlyData: Record<string, {income: number; expense: number}> = {};

    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedTransactions.forEach(t => {
      const month = new Date(t.date).toLocaleString('default', {
        month: 'short',
      });
      if (!monthlyData[month]) {
        monthlyData[month] = {income: 0, expense: 0};
      }
      monthlyData[month][t.type] += t.amount;
    });

    const overviewData = Object.entries(monthlyData).map(([name, values]) => ({
      name,
      ...values,
    }));

    const savingsRate =
      totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    return {
      totalIncome,
      totalExpenses,
      currentBalance,
      overviewData,
      currentMonthIncome,
      currentMonthExpenses,
      previousMonthIncome,
      previousMonthExpenses,
      savingsRate,
    };
  }
);
