
import type { LucideIcon } from "lucide-react";
import { Timestamp } from "firebase/firestore";

export type BudgetingMode = "tracking" | "envelope" | "hybrid";

export interface EnvelopeSettings {
  minimumOperatingBalance: number;
  fundingSuggestions: boolean;
}

export type TransferPurpose =
  | "ordinary"
  | "fund-envelope"
  | "release-to-spend"
  | "return-unused"
  | "unassign"
  | "reallocate";

export type TransactionPostingStatus = "pending" | "posted" | "removed";

export type CategorizationStatus =
  | "needs-categorization"
  | "auto-categorized"
  | "manually-categorized"
  | "needs-review";

export type CategorizationSource =
  | "manual"
  | "rule"
  | "plaid"
  | "uncategorized";

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  category: string;
  categoryId?: string;
  accountId?: string;
  envelopeId?: string | null;
  transferId?: string;
  transferDirection?: "in" | "out";
  transferPurpose?: TransferPurpose;
  relatedEnvelopeId?: string;
  linkedTransactionId?: string;
  source?: "actual" | "recurring" | "baseline" | "plaid";
  postingStatus?: TransactionPostingStatus;
  provider?: "plaid";
  providerItemId?: string;
  providerAccountId?: string;
  providerTransactionId?: string;
  pendingProviderTransactionId?: string;
  providerDescription?: string;
  merchantName?: string;
  merchantLogoUrl?: string;
  authorizedDate?: string;
  providerCategoryPrimary?: string;
  providerCategoryDetailed?: string;
  providerCategoryConfidence?: string;
  providerLastSyncedAt?: string;
  providerRemovedAt?: string;
  categorizationStatus?: CategorizationStatus;
  categorizationSource?: CategorizationSource;
  categorizationRuleId?: string;
  categorizationConflictRuleIds?: string[];
  classificationLocked?: boolean;
  categorizedAt?: string;
  reviewedAt?: string;
  possibleTransfer?: boolean;
};

export type AccountType =
  | "checking"
  | "savings"
  | "credit"
  | "cash"
  | "other";

export type AccountClassification = "asset" | "liability";

export type AccountRole =
  | "operating"
  | "envelope"
  | "debt"
  | "standard";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  classification: AccountClassification;
  openingBalance: number;
  institution?: string;
  lastFour?: string;
  currency: "USD";
  role?: AccountRole;
  isArchived?: boolean;
  isDefault?: boolean;
  createdAt: string;
  plaidItemId?: string;
  plaidAccountId?: string;
  institutionId?: string;
  institutionName?: string;
  institutionCurrentBalance?: number | null;
  institutionAvailableBalance?: number | null;
  institutionCreditLimit?: number | null;
  institutionBalanceUpdatedAt?: string;
  institutionBalanceIsRealtime?: boolean;
  plaidConnectionStatus?: PlaidItemStatus;
  openingBalanceEstimated?: boolean;
};

export type PlaidItemStatus =
  | "connecting"
  | "healthy"
  | "syncing"
  | "needs-attention"
  | "permission-expiring"
  | "delayed"
  | "disconnected";

export interface PlaidAvailableAccount {
  plaidAccountId: string;
  name: string;
  officialName?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  currentBalance?: number | null;
  availableBalance?: number | null;
  creditLimit?: number | null;
  currency?: string | null;
}

export interface PlaidItem {
  id: string;
  plaidItemId: string;
  institutionId?: string | null;
  institutionName?: string | null;
  environment?: "sandbox" | "production";
  status: PlaidItemStatus;
  syncCursor?: string | null;
  lastSuccessfulSync?: string;
  lastBalanceUpdate?: string;
  lastWebhookAt?: string;
  consentExpiresAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  availableAccounts?: PlaidAvailableAccount[];
  mappedAccountCount?: number;
  historyScope?: string;
  products: string[];
  createdAt: string;
  updatedAt: string;
}

export type CategorizationRuleOperator = "exact" | "contains";

export interface CategorizationRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: {
    direction?: "income" | "expense";
    accountIds?: string[];
    merchantMatch?: {
      operator: CategorizationRuleOperator;
      value: string;
    };
    descriptionMatch?: {
      operator: CategorizationRuleOperator;
      value: string;
    };
    providerCategoryPrimary?: string;
    providerCategoryDetailed?: string;
    minimumAmount?: number;
    maximumAmount?: number;
  };
  actions: {
    categoryId: string;
    categoryName: string;
    envelopeId?: string | null;
    markReviewed: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CategorizationAuditEvent {
  id: string;
  type: "rule-created" | "rule-updated" | "rule-deleted" | "bulk-applied" | "conflict";
  ruleId?: string;
  transactionId?: string;
  matchedCount?: number;
  note?: string;
  createdAt: string;
}

export interface PlaidSyncJob {
  id: string;
  plaidItemId: string;
  status: "queued" | "running" | "complete" | "failed";
  reason: "initial" | "webhook" | "manual" | "scheduled";
  attemptCount: number;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface BalanceSnapshot {
  id: string;
  accountId: string;
  plaidItemId: string;
  currentBalance?: number | null;
  availableBalance?: number | null;
  creditLimit?: number | null;
  isRealtime: boolean;
  recordedAt: string;
}

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

export type EnvelopeType =
  | "monthly-spending"
  | "bills"
  | "sinking-fund"
  | "savings"
  | "buffer";

export type EnvelopeFundingFrequency =
  | "manual"
  | "monthly"
  | "paycheck"
  | "target-date";

export type EnvelopeRollover = "rollover" | "reset" | "sweep";

export type Envelope = {
  id: string;
  name: string;
  type: EnvelopeType;
  backingAccountId?: string;
  categoryIds: string[];
  targetAmount?: number;
  targetDate?: string;
  dueDay?: number;
  fundingFrequency: EnvelopeFundingFrequency;
  fundingAmount?: number;
  paycheckPercentage?: number;
  priority: number;
  rollover: EnvelopeRollover;
  color: string;
  icon: string;
  isArchived?: boolean;
  createdAt: string;
};

export type EnvelopeEventType =
  | "starting-allocation"
  | "fund"
  | "release"
  | "return"
  | "expense"
  | "refund"
  | "unassign"
  | "reassign-in"
  | "reassign-out"
  | "adjustment";

export type EnvelopeEvent = {
  id: string;
  envelopeId: string;
  type: EnvelopeEventType;
  amount: number;
  date: string;
  transactionId?: string;
  transferId?: string;
  relatedEnvelopeId?: string;
  usesReleasedFunds?: boolean;
  note?: string;
  createdAt: string;
};

export type RecurringTransaction = {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  categoryId?: string;
  accountId?: string;
  envelopeId?: string;
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
  linkedEnvelopeId?: string;
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
