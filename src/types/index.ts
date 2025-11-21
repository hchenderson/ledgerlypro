
import type { LucideIcon } from "lucide-react";
import { Timestamp } from "firebase/firestore";

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  categoryId?: string;
};

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  variant: "default" | "ghost";
  badge?: string;
};

export type SubCategory = {
    id: string;
    name: string;
    icon?: string; // Storing icon name as string
    subCategories?: SubCategory[]; // Make sub-categories recursive
};

export type Category = {
    id: string;
    name: string;
    type: "income" | "expense";
    icon?: string; // Storing icon name as string
    subCategories?: SubCategory[];
};

export type Budget = {
  id: string;
  categoryId: string;
  amount: number;
  period: "monthly" | "yearly";
  isFavorite?: boolean;
};

export type RecurringTransaction = {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  categoryId?: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  startDate: string;
  lastAddedDate?: string;
};

export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate?: string;
  linkedCategoryId?: string;
  contributionStartDate?: string;
}

export type ProcessedGoal = Goal & {
  autoTrackingActive: boolean;
  autoSavedAmount: number;
  contributingTransactions: Transaction[];
  contributionLedger?: {
    transactionId: string;
    date: string;
    amount: number;
    description: string;
    category: string;
  }[];
};


export interface Widget {
  id: string;
  title: string;
  type: 'metric' | 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'composed';
  size: 'small' | 'medium' | 'large';
  mainDataKey: string | null;
  comparisonKey: string | null;
  dataCategories: string[];
  enabled: boolean;
  position: number;
  colorTheme: string;
  showLegend: boolean;
  showGrid: boolean;
  showTargetLines: boolean;
  height: number;
  customFilters: { categories: string[] };
  formulaId: string | null;
  responsive: boolean;
  animateChart: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
  customColors?: string[];
}

export interface Formula {
  id: string;
  name: string;
  expression: string;
}

export interface QuarterlyReport {
  period: string;
  startDate: string;
  endDate: string;
  createdAt: Timestamp;
  incomeSummary: Record<string, number>;
  expenseSummary: Record<string, number>;
  netIncome: number;
  budgetComparison: {
    categoryName: string;
    budget: number;
    actual: number;
    variance: number;
    percentUsed: number;
  }[];
  budgetComparisonTotals?: {
    budget: number;
    actual: number;
    variance: number;
    percentUsed: number;
  };
  goalsProgress: {
    name: string;
    targetAmount: number;
    savedAmount: number;
    progress: number;
  }[];
  kpis: {
    profitMargin: number;
    expenseToIncomeRatio: number;
  };
  notes?: string;
}
