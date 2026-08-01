
import type { LucideIcon } from "lucide-react";
import { Timestamp } from "firebase/firestore";

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  category: string;
  categoryId?: string;
  accountId?: string;
  transferId?: string;
  transferDirection?: "in" | "out";
  linkedTransactionId?: string;
  source?: "actual" | "recurring" | "baseline";
};

export type AccountType =
  | "checking"
  | "savings"
  | "credit"
  | "cash"
  | "other";

export type AccountClassification = "asset" | "liability";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  classification: AccountClassification;
  openingBalance: number;
  institution?: string;
  lastFour?: string;
  currency: "USD";
  isArchived?: boolean;
  isDefault?: boolean;
  createdAt: string;
};

export type AccountReconciliationStatus =
  | "reconciled"
  | "needs-review";

export type AccountReconciliation = {
  id: string;
  accountId: string;
  statementDate: string;
  statementBalance: number;
  ledgerBalance: number;
  difference: number;
  transactionCount: number;
  status: AccountReconciliationStatus;
  note?: string;
  createdAt: string;
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
  year: number;
  isFavorite?: boolean;
};

export type RecurringTransaction = {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  categoryId?: string;
  accountId?: string;
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
  id: string;
  period: string;
  accountIds?: string[];
  accountLabel?: string;
  startDate: string;
  endDate: string;
  createdAt: Timestamp;
  calculationVersion?: number;
  totalIncome?: number;
  totalExpenses?: number;
  transactionCount?: number;
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
    savingsRate?: number;
    averageMonthlyNet?: number;
  };
  notes?: string;
}

export interface EOYReportData {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  net: number;
  monthly: any[]; // Adjust if you have a specific type
  categories: any[]; // Adjust if you have a specific type
  mainCategories: any[]; // Add this line
}

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
};

export interface ForecastSettings {
  baselineExclusions?: {
    categories?: string[];
    merchants?: string[];
  };
  givingCategories?: string[];
  baselineMode?: "category" | "merchant" | "hybrid";
}
