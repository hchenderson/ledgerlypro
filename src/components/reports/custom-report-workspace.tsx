"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar as CalendarIcon,
  ChevronDown,
  Columns3,
  FileBarChart2,
  GripVertical,
  Lightbulb,
  ListFilter,
  MoveDown,
  MoveUp,
  PiggyBank,
  Plus,
  Save,
  Scale,
  Target,
  Trash2,
  WalletCards,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccounts } from "@/hooks/use-accounts";
import { useAuth } from "@/hooks/use-auth";
import { useBudgets } from "@/hooks/use-budgets";
import { useCategories } from "@/hooks/use-categories";
import { useEnvelopes } from "@/hooks/use-envelopes";
import { useGoals } from "@/hooks/use-goals";
import {
  type ReportViewConfiguration,
  useReportViews,
} from "@/hooks/use-report-views";
import { useToast } from "@/hooks/use-toast";
import { useAllTransactions } from "@/hooks/use-transactions";
import {
  DEFAULT_REPORT_METRICS,
  DEFAULT_REPORT_SECTIONS,
  buildReportComparisonRange,
  buildReportInsights,
  computeCategoryMovement,
  computeReportAnalytics,
  computeReportBalances,
  computeReportBudgets,
  type ReportAnalytics,
  type ReportComparisonMode,
  type ReportGranularity,
  type ReportMetricId,
  type ReportSectionId,
} from "@/lib/report-analytics";
import { cn } from "@/lib/utils";
import { buildProcessedGoals } from "@/lib/goal-progress";
import { transactionAmount } from "@/lib/financial-summary";
import type { ReportPdfData } from "@/lib/report-pdf";

const OverviewChart = dynamic(
  () =>
    import("@/components/dashboard/overview-chart").then(
      (module) => module.OverviewChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> },
);

const CategoryPieChart = dynamic(
  () =>
    import("@/components/reports/category-pie-chart").then(
      (module) => module.CategoryPieChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> },
);

const AccountBalanceChart = dynamic(
  () =>
    import("@/components/accounts/account-balance-chart").then(
      (module) => module.AccountBalanceChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> },
);

const ExportReportDialog = dynamic(
  () =>
    import("@/components/reports/export-report-dialog").then(
      (module) => module.ExportReportDialog,
    ),
  { ssr: false },
);

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const SECTION_LABELS: Record<ReportSectionId, string> = {
  summary: "Summary cards",
  "cash-flow": "Cash-flow chart",
  "category-breakdown": "Category breakdown",
  "category-movement": "Category movement",
  insights: "What changed",
  budgets: "Budget vs. actual",
  balances: "Account balances",
  transfers: "Transfer activity",
  goals: "Goals progress",
  envelopes: "Envelope performance",
  transactions: "Transaction detail",
};

const METRIC_LABELS: Record<ReportMetricId, string> = {
  income: "Income",
  expenses: "Expenses",
  net: "Net cash flow",
  "savings-rate": "Savings rate",
  "transaction-count": "Transaction count",
  "average-transaction": "Average transaction",
  "average-monthly-net": "Average monthly net",
  "largest-expense": "Largest expense",
  "largest-income": "Largest income",
  "ending-balance": "Ending balance",
  "budget-variance": "Budget remaining",
};

const ALL_METRICS = Object.keys(METRIC_LABELS) as ReportMetricId[];

const PRESETS = [
  ["this-month", "This month"],
  ["last-month", "Last month"],
  ["this-year", "Full year"],
  ["year-to-date", "Year to date"],
  ["first-half", "First half (Jan–Jun)"],
  ["second-half", "Second half (Jul–Dec)"],
  ["last-30", "Last 30 days"],
  ["last-90", "Last 90 days"],
  ["q1", "Quarter 1"],
  ["q2", "Quarter 2"],
  ["q3", "Quarter 3"],
  ["q4", "Quarter 4"],
] as const;

function defaultRange(period: "monthly" | "yearly", year: number): DateRange {
  const today = new Date();
  const base = new Date(year, today.getMonth(), 1);
  return period === "monthly"
    ? { from: startOfMonth(base), to: endOfMonth(base) }
    : { from: startOfYear(base), to: endOfYear(base) };
}

function safeRange(range: DateRange | undefined, fallback: DateRange) {
  return {
    from: range?.from ?? fallback.from!,
    to: range?.to ?? range?.from ?? fallback.to!,
  };
}

function rangeLabel(range: { from: Date; to: Date }) {
  return `${format(range.from, "MMM d, yyyy")}–${format(range.to, "MMM d, yyyy")}`;
}

function getPresetRange(value: string, activeYear: number) {
  const now = new Date();
  const base = new Date(activeYear, now.getMonth(), now.getDate());
  if (value === "this-month") return { from: startOfMonth(base), to: endOfMonth(base) };
  if (value === "last-month") {
    const date = subMonths(base, 1);
    return { from: startOfMonth(date), to: endOfMonth(date) };
  }
  if (value === "this-year") return { from: startOfYear(base), to: endOfYear(base) };
  if (value === "year-to-date") return { from: startOfYear(base), to: base };
  if (value === "first-half") return { from: new Date(activeYear, 0, 1), to: new Date(activeYear, 5, 30) };
  if (value === "second-half") return { from: new Date(activeYear, 6, 1), to: new Date(activeYear, 11, 31) };
  if (value === "last-30") return { from: subDays(base, 29), to: base };
  if (value === "last-90") return { from: subDays(base, 89), to: base };
  const quarter = /^q([1-4])$/.exec(value);
  if (quarter) {
    const startMonth = (Number(quarter[1]) - 1) * 3;
    return {
      from: new Date(activeYear, startMonth, 1),
      to: new Date(activeYear, startMonth + 3, 0),
    };
  }
  return null;
}

function ComparisonValue({
  current,
  comparison,
  inverse = false,
  percent = false,
}: {
  current: number;
  comparison?: number;
  inverse?: boolean;
  percent?: boolean;
}) {
  if (comparison === undefined) return null;
  const change = current - comparison;
  const improved = inverse ? change <= 0 : change >= 0;
  const Icon = change >= 0 ? ArrowUpRight : ArrowDownRight;
  const display =
    comparison === 0
      ? change === 0
        ? "No change"
        : "New activity"
      : `${Math.abs((change / Math.abs(comparison)) * 100).toFixed(1)}%`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        improved ? "text-emerald-600" : "text-destructive",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {percent ? `${Math.abs(change).toFixed(1)} pts` : display}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  comparison,
  inverse,
  percent,
}: {
  title: string;
  value: string;
  comparison?: { current: number; previous: number };
  inverse?: boolean;
  percent?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="break-words text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {comparison ? (
        <CardContent>
          <ComparisonValue
            current={comparison.current}
            comparison={comparison.previous}
            inverse={inverse}
            percent={percent}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}

function metricCard(
  metric: ReportMetricId,
  current: ReportAnalytics,
  comparison: ReportAnalytics | null,
  endingBalance: number,
  budgetRemaining: number,
) {
  const summary = current.summary;
  const prior = comparison?.summary;
  if (metric === "income") return <SummaryCard key={metric} title="Income" value={currency.format(summary.income)} comparison={prior ? { current: summary.income, previous: prior.income } : undefined} />;
  if (metric === "expenses") return <SummaryCard key={metric} title="Expenses" value={currency.format(summary.expenses)} comparison={prior ? { current: summary.expenses, previous: prior.expenses } : undefined} inverse />;
  if (metric === "net") return <SummaryCard key={metric} title="Net cash flow" value={currency.format(summary.net)} comparison={prior ? { current: summary.net, previous: prior.net } : undefined} />;
  if (metric === "savings-rate") return <SummaryCard key={metric} title="Savings rate" value={`${summary.savingsRate.toFixed(1)}%`} comparison={prior ? { current: summary.savingsRate, previous: prior.savingsRate } : undefined} percent />;
  if (metric === "transaction-count") return <SummaryCard key={metric} title="Transactions" value={summary.transactionCount.toLocaleString()} comparison={prior ? { current: summary.transactionCount, previous: prior.transactionCount } : undefined} />;
  if (metric === "average-transaction") return <SummaryCard key={metric} title="Average transaction" value={currency.format(summary.averageTransaction)} comparison={prior ? { current: summary.averageTransaction, previous: prior.averageTransaction } : undefined} inverse />;
  if (metric === "average-monthly-net") return <SummaryCard key={metric} title="Average monthly net" value={currency.format(summary.averageMonthlyNet)} comparison={prior ? { current: summary.averageMonthlyNet, previous: prior.averageMonthlyNet } : undefined} />;
  if (metric === "largest-expense") return <SummaryCard key={metric} title="Largest expense" value={summary.largestExpense ? `${summary.largestExpense.description} · ${currency.format(Math.abs(summary.largestExpense.amount))}` : "None"} />;
  if (metric === "largest-income") return <SummaryCard key={metric} title="Largest income" value={summary.largestIncome ? `${summary.largestIncome.description} · ${currency.format(Math.abs(summary.largestIncome.amount))}` : "None"} />;
  if (metric === "ending-balance") return <SummaryCard key={metric} title="Ending account balance" value={currency.format(endingBalance)} />;
  return <SummaryCard key={metric} title="Budget remaining" value={currency.format(budgetRemaining)} />;
}

function metricPdfValue(
  metric: ReportMetricId,
  analytics: ReportAnalytics,
  endingBalance: number,
  budgetRemaining: number,
) {
  const summary = analytics.summary;
  if (metric === "income") return currency.format(summary.income);
  if (metric === "expenses") return currency.format(summary.expenses);
  if (metric === "net") return currency.format(summary.net);
  if (metric === "savings-rate") return `${summary.savingsRate.toFixed(1)}%`;
  if (metric === "transaction-count") return summary.transactionCount.toLocaleString();
  if (metric === "average-transaction") return currency.format(summary.averageTransaction);
  if (metric === "average-monthly-net") return currency.format(summary.averageMonthlyNet);
  if (metric === "largest-expense") return summary.largestExpense ? `${summary.largestExpense.description} - ${currency.format(Math.abs(summary.largestExpense.amount))}` : "None";
  if (metric === "largest-income") return summary.largestIncome ? `${summary.largestIncome.description} - ${currency.format(Math.abs(summary.largestIncome.amount))}` : "None";
  if (metric === "ending-balance") return currency.format(endingBalance);
  return currency.format(budgetRemaining);
}

export function CustomReportWorkspace({
  period,
}: {
  period: "monthly" | "yearly";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { activeYear, setActiveYear } = useAuth();
  const { categories, loading: categoriesLoading } = useCategories();
  const {
    accounts,
    activeAccounts,
    primaryAccountId,
    selectedAccountIds: globalAccountIds,
    setSelectedAccountIds,
    loading: accountsLoading,
    getAccountName,
  } = useAccounts();
  const { budgets, loading: budgetsLoading } = useBudgets();
  const { goals, loading: goalsLoading } = useGoals();
  const {
    activeEnvelopes,
    getSummaries: getEnvelopeSummaries,
    loading: envelopesLoading,
  } = useEnvelopes();
  const {
    transactions: allTransactions,
    loading: transactionsLoading,
    error: transactionsError,
  } = useAllTransactions({ respectAccountFilter: false });
  const { views, loading: viewsLoading, saveView, deleteView } = useReportViews();

  const fallbackRange = useMemo(
    () => defaultRange(period, activeYear),
    [activeYear, period],
  );
  const [dateRange, setDateRange] = useState<DateRange | undefined>(fallbackRange);
  const [comparisonMode, setComparisonMode] = useState<ReportComparisonMode>(
    period === "yearly" ? "previous-year" : "previous-period",
  );
  const [customComparisonRange, setCustomComparisonRange] = useState<DateRange>();
  const [accountIds, setAccountIds] = useState<string[]>(globalAccountIds);
  const [transactionTypes, setTransactionTypes] = useState<
    ("income" | "expense")[]
  >(["income", "expense"]);
  const [includedCategoryKeys, setIncludedCategoryKeys] = useState<string[]>([]);
  const [excludedCategoryKeys, setExcludedCategoryKeys] = useState<string[]>([]);
  const [includePending, setIncludePending] = useState(false);
  const [includeTransfers, setIncludeTransfers] = useState(true);
  const [granularity, setGranularity] = useState<ReportGranularity>(
    period === "monthly" ? "day" : "month",
  );
  const [visibleSections, setVisibleSections] = useState<ReportSectionId[]>(
    DEFAULT_REPORT_SECTIONS,
  );
  const [sectionOrder, setSectionOrder] = useState<ReportSectionId[]>(
    DEFAULT_REPORT_SECTIONS,
  );
  const [visibleMetrics, setVisibleMetrics] = useState<ReportMetricId[]>(
    DEFAULT_REPORT_METRICS,
  );
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [selectedViewId, setSelectedViewId] = useState<string>();
  const [savingView, setSavingView] = useState(false);
  const [draggedSection, setDraggedSection] = useState<ReportSectionId | null>(null);
  const skipDefaultReset = useRef(false);

  useEffect(() => {
    if (skipDefaultReset.current) {
      skipDefaultReset.current = false;
      return;
    }
    setDateRange(fallbackRange);
    setGranularity(period === "monthly" ? "day" : "month");
  }, [fallbackRange, period]);

  const primaryRange = useMemo(
    () => safeRange(dateRange, fallbackRange),
    [dateRange, fallbackRange],
  );
  const customComparison = useMemo(
    () =>
      customComparisonRange?.from
        ? {
            from: customComparisonRange.from,
            to: customComparisonRange.to ?? customComparisonRange.from,
          }
        : undefined,
    [customComparisonRange],
  );
  const comparisonRange = useMemo(
    () =>
      buildReportComparisonRange(
        primaryRange,
        comparisonMode,
        customComparison,
      ),
    [comparisonMode, customComparison, primaryRange],
  );
  const filters = useMemo(
    () => ({
      accountIds,
      transactionTypes,
      includedCategoryKeys,
      excludedCategoryKeys,
      includePending,
      includeTransfers,
    }),
    [
      accountIds,
      excludedCategoryKeys,
      includePending,
      includeTransfers,
      includedCategoryKeys,
      transactionTypes,
    ],
  );
  const currentAnalytics = useMemo(
    () =>
      computeReportAnalytics(
        allTransactions,
        primaryRange,
        filters,
        categories,
        accounts,
        granularity,
        primaryAccountId,
      ),
    [
      accounts,
      allTransactions,
      categories,
      filters,
      granularity,
      primaryAccountId,
      primaryRange,
    ],
  );
  const comparisonAnalytics = useMemo(
    () =>
      comparisonRange
        ? computeReportAnalytics(
            allTransactions,
            comparisonRange,
            filters,
            categories,
            accounts,
            granularity,
            primaryAccountId,
          )
        : null,
    [
      accounts,
      allTransactions,
      categories,
      comparisonRange,
      filters,
      granularity,
      primaryAccountId,
    ],
  );
  const balances = useMemo(
    () => computeReportBalances(allTransactions, accounts, primaryRange, accountIds),
    [accountIds, accounts, allTransactions, primaryRange],
  );
  const budgetSummary = useMemo(
    () =>
      computeReportBudgets(
        budgets,
        categories,
        currentAnalytics.transactions,
        primaryRange,
      ),
    [budgets, categories, currentAnalytics.transactions, primaryRange],
  );
  const expenseMovement = useMemo(
    () =>
      computeCategoryMovement(
        currentAnalytics.expenseCategories,
        comparisonAnalytics?.expenseCategories ?? [],
      ),
    [currentAnalytics.expenseCategories, comparisonAnalytics?.expenseCategories],
  );
  const incomeMovement = useMemo(
    () =>
      computeCategoryMovement(
        currentAnalytics.incomeCategories,
        comparisonAnalytics?.incomeCategories ?? [],
      ),
    [currentAnalytics.incomeCategories, comparisonAnalytics?.incomeCategories],
  );
  const insights = useMemo(
    () =>
      buildReportInsights(
        currentAnalytics,
        comparisonAnalytics,
        expenseMovement,
        budgetSummary,
      ),
    [budgetSummary, comparisonAnalytics, currentAnalytics, expenseMovement],
  );
  const envelopeSummaries = useMemo(
    () => getEnvelopeSummaries(primaryRange),
    [getEnvelopeSummaries, primaryRange],
  );
  const processedGoals = useMemo(
    () =>
      buildProcessedGoals(
        goals,
        categories,
        allTransactions,
        false,
        new Map(
          envelopeSummaries.map((summary) => [
            summary.envelope.id,
            summary.available,
          ]),
        ),
      ),
    [allTransactions, categories, envelopeSummaries, goals],
  );

  const categoryOptions = useMemo(
    () => [
      ...categories
        .map((category) => ({
          value: `${category.type}:${category.id}`,
          label: `${category.type === "income" ? "Income" : "Expense"} · ${category.name}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      { value: "expense:uncategorized", label: "Expense · Uncategorized" },
      { value: "income:uncategorized", label: "Income · Uncategorized" },
    ],
    [categories],
  );
  const accountOptions = activeAccounts.map((account) => ({
    value: account.id,
    label: account.name,
  }));
  const reportDomId = `custom-${period}-report`;
  const loading =
    transactionsLoading ||
    categoriesLoading ||
    accountsLoading ||
    budgetsLoading ||
    goalsLoading ||
    envelopesLoading;
  const selectedView = views.find((view) => view.id === selectedViewId);

  const configuration = useMemo<ReportViewConfiguration>(
    () => ({
      reportPeriod: period,
      from: primaryRange.from.toISOString(),
      to: primaryRange.to.toISOString(),
      comparisonMode,
      comparisonFrom: customComparison?.from.toISOString(),
      comparisonTo: customComparison?.to.toISOString(),
      accountIds,
      transactionTypes,
      includedCategoryKeys,
      excludedCategoryKeys,
      includePending,
      includeTransfers,
      granularity,
      visibleSections,
      sectionOrder,
      visibleMetrics,
    }),
    [
      accountIds,
      comparisonMode,
      customComparison,
      excludedCategoryKeys,
      granularity,
      includePending,
      includeTransfers,
      includedCategoryKeys,
      transactionTypes,
      period,
      primaryRange.from,
      primaryRange.to,
      sectionOrder,
      visibleMetrics,
      visibleSections,
    ],
  );

  const pdfReport = useMemo<Omit<ReportPdfData, "transactions" | "accountName">>(
    () => {
      const activeSections = new Set(visibleSections);
      const tables: ReportPdfData["tables"] = [];
      if (activeSections.has("category-breakdown")) {
        tables.push({
          title: "Expense categories",
          description: "Spending by category for the selected period.",
          columns: ["Category", "Amount", "Share"],
          rows: currentAnalytics.expenseCategories.map((item) => [
            item.category,
            currency.format(item.amount),
            `${item.share.toFixed(1)}%`,
          ]),
          summaryOnly: true,
        });
        tables.push({
          title: "Income categories",
          columns: ["Category", "Amount", "Share"],
          rows: currentAnalytics.incomeCategories.map((item) => [
            item.category,
            currency.format(item.amount),
            `${item.share.toFixed(1)}%`,
          ]),
          summaryOnly: true,
        });
      }
      if (activeSections.has("category-movement") && comparisonAnalytics) {
        tables.push({
          title: "Expense category movement",
          description: `Compared with ${comparisonRange ? rangeLabel(comparisonRange) : "the selected comparison period"}.`,
          columns: ["Category", "Current", "Comparison", "Change"],
          rows: expenseMovement.map((item) => [
            item.category,
            currency.format(item.current),
            currency.format(item.comparison),
            `${item.change >= 0 ? "+" : ""}${currency.format(item.change)}`,
          ]),
        });
      }
      if (activeSections.has("budgets")) {
        tables.push({
          title: "Budget vs. actual",
          description: "Budget targets are prorated to the selected dates.",
          columns: ["Category", "Budget", "Actual", "Remaining", "Projected"],
          rows: budgetSummary.rows.map((row) => [
            row.categoryName,
            currency.format(row.budget),
            currency.format(row.actual),
            currency.format(row.remaining),
            currency.format(row.projected),
          ]),
          summaryOnly: true,
        });
      }
      if (activeSections.has("balances")) {
        tables.push({
          title: "Account balances",
          columns: ["Account", "Starting", "Ending", "Change"],
          rows: balances.accounts.map((row) => [
            row.accountName,
            currency.format(row.startingBalance),
            currency.format(row.endingBalance),
            `${row.change >= 0 ? "+" : ""}${currency.format(row.change)}`,
          ]),
          summaryOnly: true,
        });
      }
      if (activeSections.has("transfers") && includeTransfers) {
        tables.push({
          title: "Transfer activity",
          description: `${currentAnalytics.transfers.count} internal transfer${currentAnalytics.transfers.count === 1 ? "" : "s"}; transfers remain excluded from income and expenses.`,
          columns: ["Account", "Transfers in", "Transfers out", "Net"],
          rows: currentAnalytics.transfers.byAccount.map((row) => [
            row.accountName,
            currency.format(row.transfersIn),
            currency.format(row.transfersOut),
            currency.format(row.net),
          ]),
        });
      }
      if (activeSections.has("goals")) {
        tables.push({
          title: "Goals progress",
          columns: ["Goal", "Saved", "Target", "Progress"],
          rows: processedGoals.map((goal) => {
            const saved = goal.autoTrackingActive ? goal.autoSavedAmount : goal.savedAmount;
            return [
              goal.name,
              currency.format(saved),
              currency.format(goal.targetAmount),
              `${(goal.targetAmount > 0 ? (saved / goal.targetAmount) * 100 : 0).toFixed(1)}%`,
            ];
          }),
        });
      }
      if (activeSections.has("envelopes")) {
        tables.push({
          title: "Envelope performance",
          columns: ["Envelope", "Funded", "Spent", "Released", "Available", "Status"],
          rows: envelopeSummaries.map((summary) => [
            summary.envelope.name,
            currency.format(summary.funded),
            currency.format(summary.spent),
            currency.format(summary.released),
            currency.format(summary.available),
            summary.status === "healthy" ? "On track" : summary.status,
          ]),
        });
      }
      return {
        title: selectedView?.name ?? `${period === "monthly" ? "Monthly" : "Yearly"} financial report`,
        dateRange: rangeLabel(primaryRange),
        generatedAt: format(new Date(), "PPP p"),
        metadata: [
          {
            label: "Accounts",
            value:
              accountIds.length === 0
                ? "All accounts"
                : accountIds.map((id) => getAccountName(id)).join(", "),
          },
          {
            label: "Categories",
            value:
              includedCategoryKeys.length > 0
                ? `${includedCategoryKeys.length} included`
                : excludedCategoryKeys.length > 0
                  ? `${excludedCategoryKeys.length} excluded`
                  : "All categories",
          },
          {
            label: "Status",
            value: includePending ? "Posted and pending" : "Posted only",
          },
          {
            label: "Comparison",
            value: comparisonRange ? rangeLabel(comparisonRange) : "None",
          },
        ],
        metrics: visibleMetrics.map((metric) => ({
          label: METRIC_LABELS[metric],
          value: metricPdfValue(
            metric,
            currentAnalytics,
            balances.endingBalance,
            budgetSummary.remaining,
          ),
        })),
        insights: activeSections.has("insights") ? insights : [],
        tables,
        chartElementIds: [
          ...(activeSections.has("cash-flow")
            ? [`${reportDomId}-cash-flow-chart`]
            : []),
          ...(activeSections.has("category-breakdown")
            ? [`${reportDomId}-category-charts`]
            : []),
          ...(activeSections.has("balances")
            ? [`${reportDomId}-balance-chart`]
            : []),
        ],
      };
    },
    [
      accountIds,
      balances.accounts,
      balances.endingBalance,
      budgetSummary.remaining,
      budgetSummary.rows,
      comparisonAnalytics,
      comparisonRange,
      currentAnalytics,
      envelopeSummaries,
      excludedCategoryKeys.length,
      expenseMovement,
      getAccountName,
      includePending,
      includeTransfers,
      includedCategoryKeys.length,
      insights,
      period,
      primaryRange,
      processedGoals,
      reportDomId,
      selectedView?.name,
      visibleMetrics,
      visibleSections,
    ],
  );

  useEffect(() => {
    const key = `ledgerly-report-draft:${period}`;
    try {
      window.localStorage.setItem(key, JSON.stringify(configuration));
    } catch {
      // Firestore saved views remain available when browser storage is blocked.
    }
  }, [configuration, period]);

  const applyConfiguration = useCallback(
    (next: ReportViewConfiguration) => {
      const from = parseISO(next.from);
      const to = parseISO(next.to);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return;
      skipDefaultReset.current = true;
      setActiveYear(from.getFullYear());
      setDateRange({ from, to });
      setComparisonMode(next.comparisonMode);
      setCustomComparisonRange(
        next.comparisonFrom
          ? {
              from: parseISO(next.comparisonFrom),
              to: next.comparisonTo
                ? parseISO(next.comparisonTo)
                : parseISO(next.comparisonFrom),
            }
          : undefined,
      );
      setAccountIds(next.accountIds ?? []);
      setTransactionTypes(
        next.transactionTypes?.length
          ? next.transactionTypes
          : ["income", "expense"],
      );
      setIncludedCategoryKeys(next.includedCategoryKeys ?? []);
      setExcludedCategoryKeys(next.excludedCategoryKeys ?? []);
      setIncludePending(Boolean(next.includePending));
      setIncludeTransfers(next.includeTransfers !== false);
      setGranularity(next.granularity ?? (period === "monthly" ? "day" : "month"));
      setVisibleSections(next.visibleSections?.length ? next.visibleSections : DEFAULT_REPORT_SECTIONS);
      const savedSectionOrder = next.sectionOrder?.length
        ? next.sectionOrder
        : DEFAULT_REPORT_SECTIONS;
      setSectionOrder([
        ...savedSectionOrder,
        ...DEFAULT_REPORT_SECTIONS.filter(
          (section) => !savedSectionOrder.includes(section),
        ),
      ]);
      setVisibleMetrics(next.visibleMetrics?.length ? next.visibleMetrics : DEFAULT_REPORT_METRICS);
    },
    [period, setActiveYear],
  );

  const saveCurrentView = async (existingId?: string) => {
    if (!viewName.trim() && !selectedView?.name) return;
    setSavingView(true);
    try {
      const name = viewName.trim() || selectedView!.name;
      const id = await saveView(name, configuration, existingId);
      setSelectedViewId(id);
      setSaveDialogOpen(false);
      setViewName("");
      toast({ title: existingId ? "Report view updated" : "Report view saved", description: `“${name}” is available on any device.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not save report view", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSavingView(false);
    }
  };

  const removeSelectedView = async () => {
    if (!selectedView) return;
    await deleteView(selectedView.id);
    setSelectedViewId(undefined);
    toast({ title: "Report view deleted" });
  };

  const moveSection = (section: ReportSectionId, direction: -1 | 1) => {
    setSectionOrder((current) => {
      const index = current.indexOf(section);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const dropSection = (event: DragEvent<HTMLDivElement>, target: ReportSectionId) => {
    event.preventDefault();
    if (!draggedSection || draggedSection === target) return;
    setSectionOrder((current) => {
      const next = current.filter((section) => section !== draggedSection);
      next.splice(next.indexOf(target), 0, draggedSection);
      return next;
    });
    setDraggedSection(null);
  };

  const openInCompare = () => {
    setSelectedAccountIds(accountIds);
    const startMonth = primaryRange.from.getMonth();
    const endMonth = primaryRange.to.getMonth();
    let preset = "custom";
    if (startMonth === 0 && endMonth === 11) preset = "full";
    else if (startMonth === 0 && endMonth === 5) preset = "h1";
    else if (startMonth === 6 && endMonth === 11) preset = "h2";
    else if (endMonth - startMonth === 2 && startMonth % 3 === 0) {
      preset = `q${startMonth / 3 + 1}`;
    } else {
      preset = "custom-dates";
    }
    const allowed = new Set(includedCategoryKeys);
    const implicitExclusions =
      allowed.size > 0
        ? categoryOptions
            .map((option) => option.value)
            .filter((value) => !allowed.has(value))
        : [];
    const typeExclusions = categoryOptions
      .map((option) => option.value)
      .filter((value) => {
        const type = value.split(":", 1)[0];
        return !transactionTypes.includes(type as "income" | "expense");
      });
    window.localStorage.setItem(
      "ledgerly-report-compare-handoff",
      JSON.stringify({
        activeYear: primaryRange.from.getFullYear(),
        rangePreset: preset,
        startMonth,
        endMonth,
        customStartDate: format(primaryRange.from, "yyyy-MM-dd"),
        customEndDate: format(primaryRange.to, "yyyy-MM-dd"),
        excludedCategoryKeys: [
          ...new Set([
            ...excludedCategoryKeys,
            ...implicitExclusions,
            ...typeExclusions,
          ]),
        ],
      }),
    );
    router.push("/compare");
  };

  const renderSummary = () => (
    <section key="summary" aria-labelledby={`${reportDomId}-summary`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id={`${reportDomId}-summary`} className="font-headline text-lg font-semibold">Financial summary</h3>
        {comparisonRange ? <Badge variant="outline">Compared with {rangeLabel(comparisonRange)}</Badge> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visibleMetrics.map((metric) =>
          metricCard(
            metric,
            currentAnalytics,
            comparisonAnalytics,
            balances.endingBalance,
            budgetSummary.remaining,
          ),
        )}
      </div>
    </section>
  );

  const renderCashFlow = () => (
    <Card key="cash-flow" id={`${reportDomId}-cash-flow-chart`} data-pdf-title="Income vs. expense chart">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Income vs. expense</CardTitle>
        <CardDescription>Every point uses the same account, category, status, and date filters as the summary cards.</CardDescription>
      </CardHeader>
      <CardContent>
        {currentAnalytics.periods.length > 0 ? (
          <OverviewChart data={currentAnalytics.periods} />
        ) : (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No cash-flow activity matches these filters.</p>
        )}
      </CardContent>
    </Card>
  );

  const renderCategoryBreakdown = () => (
    <div key="category-breakdown" id={`${reportDomId}-category-charts`} data-pdf-title="Category breakdown charts" className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Income breakdown</CardTitle><CardDescription>Where income came from in this period.</CardDescription></CardHeader>
        <CardContent><CategoryPieChart data={currentAnalytics.incomeCategories} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Expense breakdown</CardTitle><CardDescription>Where spending went in this period.</CardDescription></CardHeader>
        <CardContent><CategoryPieChart data={currentAnalytics.expenseCategories} /></CardContent>
      </Card>
    </div>
  );

  const movementTable = (rows: typeof expenseMovement, inverse = false) => (
    <Table>
      <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Current</TableHead><TableHead className="text-right">Comparison</TableHead><TableHead className="text-right">Change</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.slice(0, 12).map((row) => {
          const positive = inverse ? row.change <= 0 : row.change >= 0;
          return (
            <TableRow key={row.category}>
              <TableCell className="font-medium">{row.category}</TableCell>
              <TableCell className="text-right tabular-nums">{currency.format(row.current)}</TableCell>
              <TableCell className="text-right tabular-nums">{currency.format(row.comparison)}</TableCell>
              <TableCell className={cn("text-right font-medium tabular-nums", positive ? "text-emerald-600" : "text-destructive")}>{row.change >= 0 ? "+" : ""}{currency.format(row.change)}{row.percentChange !== null ? <span className="block text-xs font-normal">{row.percentChange.toFixed(1)}%</span> : null}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  const renderCategoryMovement = () => (
    <Card key="category-movement">
      <CardHeader><CardTitle>Category movement</CardTitle><CardDescription>{comparisonRange ? `Changes versus ${rangeLabel(comparisonRange)}.` : "Choose a comparison period to see category changes."}</CardDescription></CardHeader>
      <CardContent>
        {comparisonAnalytics ? (
          <Tabs defaultValue="expenses">
            <TabsList className="grid w-full grid-cols-2 sm:w-80"><TabsTrigger value="expenses">Expenses</TabsTrigger><TabsTrigger value="income">Income</TabsTrigger></TabsList>
            <TabsContent value="expenses" className="mt-4 overflow-x-auto">{movementTable(expenseMovement, true)}</TabsContent>
            <TabsContent value="income" className="mt-4 overflow-x-auto">{movementTable(incomeMovement)}</TabsContent>
          </Tabs>
        ) : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Comparison is currently turned off.</p>}
      </CardContent>
    </Card>
  );

  const renderInsights = () => (
    <Card key="insights" className="brand-surface text-white">
      <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Lightbulb className="h-5 w-5 text-brand-tint" /> What changed</CardTitle><CardDescription className="text-white/70">Reliable, rules-based observations from the selected report.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {insights.length > 0 ? insights.map((insight) => <div key={insight} className="rounded-xl bg-white/10 p-4 text-sm leading-6 text-white/85">{insight}</div>) : <div className="rounded-xl bg-white/10 p-4 text-sm text-white/75">Add more activity or a comparison period to generate insights.</div>}
      </CardContent>
    </Card>
  );

  const renderBudgets = () => (
    <Card key="budgets">
      <CardHeader><CardTitle className="flex items-center gap-2"><PiggyBank className="h-5 w-5" /> Budget vs. actual</CardTitle><CardDescription>Budgets are prorated to the exact selected dates.</CardDescription></CardHeader>
      <CardContent>
        {budgetSummary.rows.length > 0 ? <>
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            {[['Budget', budgetSummary.budget], ['Actual', budgetSummary.actual], ['Remaining', budgetSummary.remaining]].map(([label, value]) => <div key={String(label)} className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{currency.format(Number(value))}</p></div>)}
            <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Used</p><p className="mt-1 text-lg font-semibold">{budgetSummary.percentUsed.toFixed(1)}%</p></div>
          </div>
          <div className="space-y-4">
            {budgetSummary.rows.map((row) => <div key={row.budgetId}><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-medium">{row.categoryName}</span><span className="text-right tabular-nums">{currency.format(row.actual)} / {currency.format(row.budget)}<span className="block text-xs text-muted-foreground">Projected {currency.format(row.projected)}</span></span></div><Progress value={Math.min(100, row.percentUsed)} className={cn("h-2", row.percentUsed > 100 && "[&>div]:bg-destructive")} /></div>)}
          </div>
        </> : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No budgets apply to this date range.</p>}
      </CardContent>
    </Card>
  );

  const renderBalances = () => (
    <Card key="balances" id={`${reportDomId}-balance-chart`} data-pdf-title="Account balance chart">
      <CardHeader><CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> Account balances</CardTitle><CardDescription>Opening balances plus finalized income, expenses, and transfers through each day.</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[['Starting', balances.startingBalance], ['Ending', balances.endingBalance], ['Lowest', balances.lowestBalance], ['Highest', balances.highestBalance], ['Daily average', balances.averageDailyBalance]].map(([label, value]) => <div key={String(label)} className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{currency.format(Number(value))}</p></div>)}
        </div>
        {balances.daily.length > 1 ? <AccountBalanceChart data={balances.daily.map((point) => ({ ...point, label: format(parseISO(point.date), "MMM d") }))} accountName={accountIds.length === 1 ? getAccountName(accountIds[0]) : "Selected accounts"} activeYear={primaryRange.to.getFullYear()} isLiability={false} /> : null}
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Starting</TableHead><TableHead className="text-right">Ending</TableHead><TableHead className="text-right">Change</TableHead></TableRow></TableHeader><TableBody>{balances.accounts.map((row) => <TableRow key={row.accountId}><TableCell className="font-medium">{row.accountName}</TableCell><TableCell className="text-right tabular-nums">{currency.format(row.startingBalance)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(row.endingBalance)}</TableCell><TableCell className={cn("text-right font-medium tabular-nums", row.change >= 0 ? "text-emerald-600" : "text-destructive")}>{row.change >= 0 ? "+" : ""}{currency.format(row.change)}</TableCell></TableRow>)}</TableBody></Table></div>
      </CardContent>
    </Card>
  );

  const renderTransfers = () => (
    <Card key="transfers">
      <CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" /> Transfer activity</CardTitle><CardDescription>Transfers affect account balances but remain excluded from income and expenses.</CardDescription></CardHeader>
      <CardContent>
        {!includeTransfers ? <Alert><ListFilter className="h-4 w-4" /><AlertTitle>Transfers hidden</AlertTitle><AlertDescription>Turn on “Include transfer details” in Filters to populate this section.</AlertDescription></Alert> : <>
          <div className="mb-5 grid gap-3 sm:grid-cols-4">{[['Moved', currentAnalytics.transfers.totalMoved], ['Transfers in', currentAnalytics.transfers.transfersIn], ['Transfers out', currentAnalytics.transfers.transfersOut], ['Net', currentAnalytics.transfers.net]].map(([label, value]) => <div key={String(label)} className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{currency.format(Number(value))}</p></div>)}</div>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">In</TableHead><TableHead className="text-right">Out</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader><TableBody>{currentAnalytics.transfers.byAccount.map((row) => <TableRow key={row.accountId}><TableCell>{row.accountName}</TableCell><TableCell className="text-right tabular-nums">{currency.format(row.transfersIn)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(row.transfersOut)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(row.net)}</TableCell></TableRow>)}</TableBody></Table></div>
        </>}
      </CardContent>
    </Card>
  );

  const renderGoals = () => {
    const includedTransactionIds = new Set(
      currentAnalytics.financialTransactions.map((transaction) => transaction.id),
    );
    return (
      <Card key="goals">
        <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Goals progress</CardTitle><CardDescription>Current goal progress with contributions matching this report period.</CardDescription></CardHeader>
        <CardContent>
          {processedGoals.length > 0 ? <div className="space-y-5">{processedGoals.map((goal) => {
            const saved = goal.autoTrackingActive ? goal.autoSavedAmount : goal.savedAmount;
            const progress = goal.targetAmount > 0 ? (saved / goal.targetAmount) * 100 : 0;
            const periodContribution = goal.contributingTransactions.filter((transaction) => includedTransactionIds.has(transaction.id)).reduce((sum, transaction) => sum + transactionAmount(transaction), 0);
            return <div key={goal.id}><div className="mb-2 flex items-start justify-between gap-3"><div><p className="font-medium">{goal.name}</p><p className="text-xs text-muted-foreground">{currency.format(saved)} of {currency.format(goal.targetAmount)} · {currency.format(periodContribution)} in this report period</p></div><span className="font-semibold tabular-nums">{progress.toFixed(1)}%</span></div><Progress value={Math.min(progress, 100)} className="h-2" /></div>;
          })}</div> : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No goals have been created yet.</p>}
        </CardContent>
      </Card>
    );
  };

  const renderEnvelopes = () => (
    <Card key="envelopes">
      <CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" /> Envelope performance</CardTitle><CardDescription>Funding, spending, and available assigned money during the selected dates.</CardDescription></CardHeader>
      <CardContent>
        {activeEnvelopes.length > 0 ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Envelope</TableHead><TableHead className="text-right">Funded</TableHead><TableHead className="text-right">Spent</TableHead><TableHead className="text-right">Released</TableHead><TableHead className="text-right">Available</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{envelopeSummaries.map((summary) => <TableRow key={summary.envelope.id}><TableCell className="font-medium">{summary.envelope.name}</TableCell><TableCell className="text-right tabular-nums">{currency.format(summary.funded)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(summary.spent)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(summary.released)}</TableCell><TableCell className={cn("text-right tabular-nums", summary.available < 0 && "text-destructive")}>{currency.format(summary.available)}</TableCell><TableCell><Badge variant={summary.status === "overspent" ? "destructive" : summary.status === "underfunded" ? "outline" : "secondary"}>{summary.status === "healthy" ? "On track" : summary.status === "underfunded" ? "Underfunded" : "Overspent"}</Badge></TableCell></TableRow>)}</TableBody></Table></div> : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Envelope budgeting is not configured.</p>}
      </CardContent>
    </Card>
  );

  const renderTransactions = () => (
    <Card key="transactions">
      <CardHeader><CardTitle>Transaction detail</CardTitle><CardDescription>{currentAnalytics.transactions.length} matching entries. The CSV export contains this exact filtered set.</CardDescription></CardHeader>
      <CardContent>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Account</TableHead><TableHead>Category</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{currentAnalytics.transactions.slice(0, 100).map((transaction) => <TableRow key={transaction.id}><TableCell className="whitespace-nowrap">{format(parseISO(transaction.date), "MMM d, yyyy")}</TableCell><TableCell className="max-w-xs truncate font-medium">{transaction.description}</TableCell><TableCell>{getAccountName(transaction.accountId)}</TableCell><TableCell>{transaction.category}</TableCell><TableCell className="capitalize">{transaction.type}</TableCell><TableCell className="text-right tabular-nums">{currency.format(Math.abs(transaction.amount))}</TableCell></TableRow>)}</TableBody></Table></div>
        {currentAnalytics.transactions.length > 100 ? <p className="mt-3 text-center text-xs text-muted-foreground">Showing the first 100 entries. Export CSV for all {currentAnalytics.transactions.length}.</p> : null}
      </CardContent>
    </Card>
  );

  const sectionRenderers: Record<ReportSectionId, () => React.ReactNode> = {
    summary: renderSummary,
    "cash-flow": renderCashFlow,
    "category-breakdown": renderCategoryBreakdown,
    "category-movement": renderCategoryMovement,
    insights: renderInsights,
    budgets: renderBudgets,
    balances: renderBalances,
    transfers: renderTransfers,
    goals: renderGoals,
    envelopes: renderEnvelopes,
    transactions: renderTransactions,
  };

  if (loading) return <div className="space-y-5"><Skeleton className="h-36" /><Skeleton className="h-96" /><Skeleton className="h-72" /></div>;
  if (transactionsError) return <Alert variant="destructive"><AlertTitle>Report data is unavailable</AlertTitle><AlertDescription>{transactionsError.message}</AlertDescription></Alert>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><FileBarChart2 className="h-5 w-5 text-primary" /> Custom report workspace</CardTitle>
            <CardDescription className="mt-1">Build, save, reorder, compare, and export a report around the questions that matter to you.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <Select value={selectedViewId ?? "none"} onValueChange={(value) => { if (value === "none") { setSelectedViewId(undefined); return; } const view = views.find((candidate) => candidate.id === value); if (view) { setSelectedViewId(value); applyConfiguration(view.configuration); } }}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder={viewsLoading ? "Loading saved views…" : "Saved report views"} /></SelectTrigger>
              <SelectContent><SelectItem value="none">Unsaved custom report</SelectItem>{views.filter((view) => view.configuration.reportPeriod === period).map((view) => <SelectItem key={view.id} value={view.id}>{view.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setViewName(""); setSaveDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Save view</Button>
            {selectedView ? <Button variant="outline" onClick={() => void saveCurrentView(selectedView.id)}><Save className="mr-2 h-4 w-4" /> Update</Button> : null}
            <ExportReportDialog transactions={currentAnalytics.transactions} dateRange={primaryRange} chartId={reportDomId} chartTitle={selectedView?.name ?? `${period} financial report`} pdfReport={pdfReport} />
          </div>
        </CardHeader>
        {selectedView ? <CardContent className="flex flex-wrap items-center gap-2 border-t pt-4 text-sm"><Badge variant="secondary">Saved: {selectedView.name}</Badge><Button variant="ghost" size="sm" className="text-destructive" onClick={() => void removeSelectedView()}><Trash2 className="mr-1 h-4 w-4" /> Delete saved view</Button></CardContent> : null}
      </Card>

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} asChild>
        <Card>
          <CardHeader className="py-4"><CollapsibleTrigger asChild><Button variant="ghost" className="-mx-2 flex h-auto w-[calc(100%+1rem)] justify-between px-2 py-1"><span className="flex items-center gap-2 font-semibold"><ListFilter className="h-4 w-4" /> Filters and comparison</span><ChevronDown className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")} /></Button></CollapsibleTrigger></CardHeader>
          <CollapsibleContent>
            <CardContent className="grid gap-5 border-t pt-5 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2"><Label>Date range</Label><div className="flex gap-2"><Select onValueChange={(value) => { const next = getPresetRange(value, activeYear); if (next) setDateRange(next); }}><SelectTrigger className="w-44"><SelectValue placeholder="Preset" /></SelectTrigger><SelectContent>{PRESETS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Popover><PopoverTrigger asChild><Button variant="outline" className="min-w-0 flex-1 justify-start"><CalendarIcon className="mr-2 h-4 w-4" /><span className="truncate">{rangeLabel(primaryRange)}</span></Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={1} /></PopoverContent></Popover></div></div>
              <div className="space-y-2"><Label>Compare with</Label><Select value={comparisonMode} onValueChange={(value) => setComparisonMode(value as ReportComparisonMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No comparison</SelectItem><SelectItem value="previous-period">Previous matching period</SelectItem><SelectItem value="previous-month">Previous month</SelectItem><SelectItem value="previous-quarter">Previous quarter</SelectItem><SelectItem value="previous-year">Same period last year</SelectItem><SelectItem value="custom">Custom date range</SelectItem></SelectContent></Select>{comparisonRange ? <p className="text-xs text-muted-foreground">{rangeLabel(comparisonRange)}</p> : null}</div>
              <div className="space-y-2"><Label>Group chart by</Label><Select value={granularity} onValueChange={(value) => setGranularity(value as ReportGranularity)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Day</SelectItem><SelectItem value="week">Week</SelectItem><SelectItem value="month">Month</SelectItem><SelectItem value="quarter">Quarter</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Cash-flow types</Label><Select value={transactionTypes.length === 2 ? "both" : transactionTypes[0]} onValueChange={(value) => setTransactionTypes(value === "both" ? ["income", "expense"] : [value as "income" | "expense"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="both">Income and expenses</SelectItem><SelectItem value="income">Income only</SelectItem><SelectItem value="expense">Expenses only</SelectItem></SelectContent></Select></div>
              {comparisonMode === "custom" ? <div className="space-y-2 md:col-span-2 xl:col-span-3"><Label>Custom comparison dates</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{customComparison ? rangeLabel(customComparison) : "Choose comparison dates"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="range" selected={customComparisonRange} onSelect={setCustomComparisonRange} numberOfMonths={1} /></PopoverContent></Popover></div> : null}
              <div className="space-y-2"><Label>Accounts</Label><SearchableMultiSelect options={accountOptions} selected={accountIds} onChange={setAccountIds} placeholder="All accounts" searchPlaceholder="Search accounts…" /><p className="text-xs text-muted-foreground">No selection includes all accounts and their historical activity.</p></div>
              <div className="space-y-2"><Label>Only include categories</Label><SearchableMultiSelect options={categoryOptions} selected={includedCategoryKeys} onChange={(next) => { setIncludedCategoryKeys(next); setExcludedCategoryKeys((current) => current.filter((key) => !next.includes(key))); }} placeholder="All categories" searchPlaceholder="Search categories…" /></div>
              <div className="space-y-2"><Label>Exclude categories</Label><SearchableMultiSelect options={categoryOptions} selected={excludedCategoryKeys} onChange={(next) => { setExcludedCategoryKeys(next); setIncludedCategoryKeys((current) => current.filter((key) => !next.includes(key))); }} placeholder="Exclude none" searchPlaceholder="Search categories…" /></div>
              <div className="flex items-center justify-between rounded-xl border p-4"><div><Label htmlFor={`${period}-pending`}>Include pending</Label><p className="text-xs text-muted-foreground">Clearly includes pending bank entries.</p></div><Switch id={`${period}-pending`} checked={includePending} onCheckedChange={setIncludePending} /></div>
              <div className="flex items-center justify-between rounded-xl border p-4"><div><Label htmlFor={`${period}-transfers`}>Include transfer details</Label><p className="text-xs text-muted-foreground">Never counted as income or expense.</p></div><Switch id={`${period}-transfers`} checked={includeTransfers} onCheckedChange={setIncludeTransfers} /></div>
              <div className="flex items-end"><Button className="w-full" variant="secondary" onClick={openInCompare}>Open this period in Compare <ArrowUpRight className="ml-2 h-4 w-4" /></Button></div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={customizeOpen} onOpenChange={setCustomizeOpen} asChild>
        <Card>
          <CardHeader className="py-4"><CollapsibleTrigger asChild><Button variant="ghost" className="-mx-2 flex h-auto w-[calc(100%+1rem)] justify-between px-2 py-1"><span className="flex items-center gap-2 font-semibold"><Columns3 className="h-4 w-4" /> Customize sections and cards</span><ChevronDown className={cn("h-4 w-4 transition-transform", customizeOpen && "rotate-180")} /></Button></CollapsibleTrigger></CardHeader>
          <CollapsibleContent><CardContent className="grid gap-6 border-t pt-5 lg:grid-cols-2"><div><h4 className="mb-3 font-semibold">Summary cards</h4><div className="grid gap-2 sm:grid-cols-2">{ALL_METRICS.map((metric) => <Label key={metric} className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2"><Checkbox checked={visibleMetrics.includes(metric)} onCheckedChange={(checked) => setVisibleMetrics((current) => checked ? [...current, metric] : current.filter((item) => item !== metric))} />{METRIC_LABELS[metric]}</Label>)}</div></div><div><h4 className="mb-1 font-semibold">Sections</h4><p className="mb-3 text-xs text-muted-foreground">Drag with a mouse, or use the arrow buttons for keyboard and touch reordering.</p><div className="space-y-2">{sectionOrder.map((section, index) => <div key={section} draggable onDragStart={() => setDraggedSection(section)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropSection(event, section)} onDragEnd={() => setDraggedSection(null)} className={cn("flex items-center gap-2 rounded-lg border p-2", draggedSection === section && "opacity-50")}><GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" /><Checkbox checked={visibleSections.includes(section)} onCheckedChange={(checked) => setVisibleSections((current) => checked ? [...new Set([...current, section])] : current.filter((item) => item !== section))} /><span className="min-w-0 flex-1 text-sm font-medium">{SECTION_LABELS[section]}</span><Button variant="ghost" size="icon" aria-label={`Move ${SECTION_LABELS[section]} up`} disabled={index === 0} onClick={() => moveSection(section, -1)}><MoveUp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`Move ${SECTION_LABELS[section]} down`} disabled={index === sectionOrder.length - 1} onClick={() => moveSection(section, 1)}><MoveDown className="h-4 w-4" /></Button></div>)}</div></div></CardContent></CollapsibleContent>
        </Card>
      </Collapsible>

      <div className="flex flex-wrap items-center gap-2 text-sm"><Badge variant="outline">{rangeLabel(primaryRange)}</Badge><Badge variant="outline">{accountIds.length === 0 ? "All accounts" : `${accountIds.length} account${accountIds.length === 1 ? "" : "s"}`}</Badge>{includedCategoryKeys.length > 0 ? <Badge variant="secondary">{includedCategoryKeys.length} included categories</Badge> : null}{excludedCategoryKeys.length > 0 ? <Badge variant="secondary">{excludedCategoryKeys.length} excluded categories</Badge> : null}{includePending ? <Badge variant="destructive">Pending included</Badge> : <Badge variant="secondary">Posted only</Badge>}</div>

      <div id={reportDomId} className="space-y-6 rounded-xl">
        {sectionOrder.filter((section) => visibleSections.includes(section)).map((section) => sectionRenderers[section]())}
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Save this report view</DialogTitle><DialogDescription>The dates, filters, comparison, cards, and section order will be stored in your Firebase account.</DialogDescription></DialogHeader><div className="space-y-2 py-2"><Label htmlFor={`${period}-view-name`}>View name</Label><Input id={`${period}-view-name`} value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="e.g. Monthly household review" autoFocus /></div><DialogFooter><Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button><Button disabled={!viewName.trim() || savingView} onClick={() => void saveCurrentView()}>{savingView ? "Saving…" : "Save view"}</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
