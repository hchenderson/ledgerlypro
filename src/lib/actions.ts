
'use server';

import type { Transaction } from "@/types";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export type DashboardAnalytics = {
  totalIncome: number;
  totalExpenses: number;
  currentBalance: number;
  overviewData: { name: string; income: number; expense: number }[];
  currentMonthIncome: number;
  currentMonthExpenses: number;
  savingsRate: number;
}
