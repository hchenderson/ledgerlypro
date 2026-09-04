export const DASHBOARD_CARD_OPTIONS = [
  { id: "balance", label: "Current or ending balance" },
  { id: "last-updated", label: "Last updated" },
  { id: "total-income", label: "Total income" },
  { id: "total-expenses", label: "Total expenses" },
  { id: "total-savings", label: "Total savings" },
  { id: "current-month-income", label: "Current month income" },
  { id: "current-month-expenses", label: "Current month expenses" },
  { id: "savings-rate", label: "Savings rate" },
  { id: "previous-month-income", label: "Previous month income" },
  { id: "previous-month-expenses", label: "Previous month expenses" },
  { id: "overview-chart", label: "Income vs. expense chart" },
  { id: "recent-transactions", label: "Recent transactions" },
  { id: "savings-goals", label: "Savings goals" },
  { id: "favorite-budgets", label: "Favorite budgets" },
  { id: "forward-analytics", label: "Forward analytics" },
  { id: "envelope-snapshot", label: "Envelope snapshot" },
] as const;

export type DashboardCardId =
  (typeof DASHBOARD_CARD_OPTIONS)[number]["id"];

export interface DashboardPreferences {
  visibleCards: DashboardCardId[];
  includedCategoryKeys: string[];
  excludedCategoryKeys: string[];
}

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  visibleCards: DASHBOARD_CARD_OPTIONS.map((option) => option.id),
  includedCategoryKeys: [],
  excludedCategoryKeys: [],
};

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string"))];
}

export function normalizeDashboardPreferences(
  value: unknown,
): DashboardPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_DASHBOARD_PREFERENCES };
  }
  const candidate = value as Partial<DashboardPreferences>;
  const validCardIds = new Set<DashboardCardId>(
    DASHBOARD_CARD_OPTIONS.map((option) => option.id),
  );
  const visibleCards = Array.isArray(candidate.visibleCards)
    ? uniqueStrings(candidate.visibleCards).filter(
        (id): id is DashboardCardId => validCardIds.has(id as DashboardCardId),
      )
    : [...DEFAULT_DASHBOARD_PREFERENCES.visibleCards];
  const includedCategoryKeys = uniqueStrings(candidate.includedCategoryKeys);
  const includedSet = new Set(includedCategoryKeys);
  return {
    visibleCards,
    includedCategoryKeys,
    excludedCategoryKeys: uniqueStrings(candidate.excludedCategoryKeys).filter(
      (key) => !includedSet.has(key),
    ),
  };
}
