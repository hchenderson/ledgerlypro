export type BudgetPortalFreshness = {
  summaryUpdatedAt: string;
  bankActivitySyncedAt: string | null;
  bankCoverage: "current" | "stale" | "partial" | "failed" | "unknown";
  reviewedThrough: string | null;
  reviewedThroughScope: "ledger";
};

export type BudgetPortalCategoryLine = {
  categoryId: string | null;
  name: string;
  spendingMinor: number;
};

export type BudgetPortalBudgetSummary = {
  id: string;
  name: string;
  period: "monthly" | "yearly";
  periodLabel: string;
  budgetedMinor: number;
  spendingMinor: number;
  remainingMinor: number;
  percentageUsed: number | null;
  overBudget: boolean;
  categoryBreakdown: BudgetPortalCategoryLine[];
  overlapsOtherAssignedBudget: boolean;
};

export type BudgetPortalSummaryResponse = {
  viewer: { displayName: string | null };
  budgets: BudgetPortalBudgetSummary[];
  unavailableAssignments: number;
  freshness: BudgetPortalFreshness;
  notice: string | null;
};

export type BudgetPortalGrant = {
  id: string;
  email: string;
  displayName: string | null;
  budgetIds: string[];
  status: "pending" | "active" | "revoked";
  createdAt: string | null;
  updatedAt: string | null;
  lastSuccessfulPortalSignIn: string | null;
};
