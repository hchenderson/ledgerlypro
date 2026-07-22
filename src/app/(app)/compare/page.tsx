"use client";

import { useEffect, useMemo, useState } from "react";
import { format as formatDate } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  GitCompareArrows,
  Lightbulb,
  ListFilter,
  RotateCcw,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import {
  ComparisonTrendChart,
  type ComparisonMetric,
} from "@/components/comparison/comparison-trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useComparison } from "@/hooks/use-comparison";
import { useUserData } from "@/hooks/use-user-data";
import {
  buildComparisonDateRanges,
  computeYearComparison,
  type CategoryComparison,
  type ComparisonDelta,
  type ComparisonRangePreset,
} from "@/lib/comparison-analytics";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

function DeltaBadge({ delta, inverse = false }: { delta: ComparisonDelta; inverse?: boolean }) {
  const improved = inverse ? delta.value <= 0 : delta.value >= 0;
  const Icon = delta.value >= 0 ? ArrowUpRight : ArrowDownRight;
  const label =
    delta.percent === null
      ? "New activity"
      : `${Math.abs(delta.percent).toFixed(1)}%`;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-transparent",
        improved
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-destructive/10 text-destructive"
      )}
    >
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
}

function MetricCard({
  title,
  primary,
  comparison,
  delta,
  primaryYear,
  comparisonYear,
  format = currency.format,
  inverse = false,
}: {
  title: string;
  primary: number;
  comparison: number;
  delta: ComparisonDelta;
  primaryYear: number;
  comparisonYear: number;
  format?: (value: number) => string;
  inverse?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 font-headline text-2xl font-semibold tracking-tight">
              {format(primary)}
            </p>
          </div>
          <DeltaBadge delta={delta} inverse={inverse} />
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span>{primaryYear}</span>
          <span>{comparisonYear}: {format(comparison)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryBreakdown({
  data,
  primaryYear,
  comparisonYear,
  limit,
  inverse,
}: {
  data: CategoryComparison[];
  primaryYear: number;
  comparisonYear: number;
  limit: number;
  inverse?: boolean;
}) {
  const visible = data.slice(0, limit);
  const maxValue = Math.max(
    1,
    ...visible.flatMap((item) => [item.primary, item.comparison])
  );

  if (visible.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        No category activity was recorded for this period.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" />{primaryYear}</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-brand-navy" />{comparisonYear}</span>
      </div>
      {visible.map((item) => {
        const improved = inverse ? item.delta <= 0 : item.delta >= 0;
        return (
          <div key={item.category} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.category}</p>
                <p className="text-xs text-muted-foreground">
                  {item.primaryShare.toFixed(1)}% of {primaryYear} total
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-semibold">{currency.format(item.primary)}</p>
                <p className={cn("text-xs", improved ? "text-emerald-600" : "text-destructive")}>
                  {item.delta >= 0 ? "+" : ""}{currency.format(item.delta)}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${(item.primary / maxValue) * 100}%` }} />
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-brand-navy/70" style={{ width: `${(item.comparison / maxValue) * 100}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompareSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36" />)}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export default function ComparePage() {
  const { activeYear, firstYear } = useAuth();
  const { allTransactions, categories, loading } = useUserData();
  const { comparisonYear, setComparisonYear } = useComparison();
  const [rangePreset, setRangePreset] = useState<ComparisonRangePreset>("ytd");
  const [startMonth, setStartMonth] = useState(0);
  const [endMonth, setEndMonth] = useState(11);
  const [metric, setMetric] = useState<ComparisonMetric>("net");
  const [categoryLimit, setCategoryLimit] = useState(5);
  const [cumulative, setCumulative] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const transaction of allTransactions) {
      const year = new Date(transaction.date).getFullYear();
      if (Number.isFinite(year) && year !== activeYear) years.add(year);
    }
    const oldestSuggestedYear = Math.min(firstYear, activeYear - 5);
    for (let year = activeYear - 1; year >= oldestSuggestedYear; year -= 1) {
      years.add(year);
    }
    return [...years].filter((year) => year !== activeYear).sort((a, b) => b - a);
  }, [activeYear, allTransactions, firstYear]);

  const selectedComparisonYear =
    comparisonYear && comparisonYear !== activeYear
      ? comparisonYear
      : (availableYears[0] ?? activeYear - 1);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("ledgerly-comparison-preferences");
      if (saved) {
        const preferences = JSON.parse(saved) as {
          rangePreset?: ComparisonRangePreset;
          startMonth?: number;
          endMonth?: number;
          metric?: ComparisonMetric;
          categoryLimit?: number;
          cumulative?: boolean;
        };
        if (preferences.rangePreset) setRangePreset(preferences.rangePreset);
        if (Number.isInteger(preferences.startMonth)) setStartMonth(preferences.startMonth!);
        if (Number.isInteger(preferences.endMonth)) setEndMonth(preferences.endMonth!);
        if (preferences.metric) setMetric(preferences.metric);
        if ([5, 8, 12].includes(preferences.categoryLimit ?? 0)) setCategoryLimit(preferences.categoryLimit!);
        if (typeof preferences.cumulative === "boolean") setCumulative(preferences.cumulative);
      }
    } catch {
      // Ignore stale or malformed browser preferences and use safe defaults.
    } finally {
      setPreferencesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    window.localStorage.setItem(
      "ledgerly-comparison-preferences",
      JSON.stringify({ rangePreset, startMonth, endMonth, metric, categoryLimit, cumulative })
    );
  }, [categoryLimit, cumulative, endMonth, metric, preferencesLoaded, rangePreset, startMonth]);

  const ranges = useMemo(
    () =>
      buildComparisonDateRanges({
        preset: rangePreset,
        primaryYear: activeYear,
        comparisonYear: selectedComparisonYear,
        startMonth,
        endMonth,
      }),
    [activeYear, endMonth, rangePreset, selectedComparisonYear, startMonth]
  );

  const analytics = useMemo(
    () =>
      computeYearComparison(
        allTransactions,
        activeYear,
        selectedComparisonYear,
        ranges,
        categories
      ),
    [activeYear, allTransactions, categories, ranges, selectedComparisonYear]
  );

  const largestExpenseMover = useMemo(
    () => [...analytics.expenseCategories].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0],
    [analytics.expenseCategories]
  );

  const primaryRangeLabel = `${formatDate(ranges.primary.from, "MMM d, yyyy")}–${formatDate(ranges.primary.to, "MMM d, yyyy")}`;
  const comparisonRangeLabel = `${formatDate(ranges.comparison.from, "MMM d, yyyy")}–${formatDate(ranges.comparison.to, "MMM d, yyyy")}`;
  const hasAnyData = analytics.primary.transactionCount + analytics.comparison.transactionCount > 0;

  const resetPreferences = () => {
    setRangePreset("ytd");
    setStartMonth(0);
    setEndMonth(11);
    setMetric("net");
    setCategoryLimit(5);
    setCumulative(false);
    setComparisonYear(undefined);
  };

  if (loading) return <CompareSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <GitCompareArrows className="h-4 w-4" /> Comparison workspace
          </div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-brand-navy dark:text-white">
            {activeYear} vs. {selectedComparisonYear}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Compare matching periods, uncover category shifts, and customize the view around the questions that matter to you.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit gap-2 px-3 py-1.5">
          <CalendarRange className="h-4 w-4" /> {primaryRangeLabel}
        </Badge>
      </div>

      <Card className="border-primary/15 bg-card/95">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><ListFilter className="h-5 w-5 text-primary" /> Customize comparison</CardTitle>
              <CardDescription className="mt-1">These choices are saved on this device.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={resetPreferences}><RotateCcw className="h-4 w-4" /> Reset</Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <Label>Comparison year</Label>
            <Select value={String(selectedComparisonYear)} onValueChange={(value) => setComparisonYear(Number(value))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{availableYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Period</Label>
            <Select value={rangePreset} onValueChange={(value) => setRangePreset(value as ComparisonRangePreset)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ytd">Year to date</SelectItem>
                <SelectItem value="full">Full year</SelectItem>
                <SelectItem value="h1">First half (Jan–Jun)</SelectItem>
                <SelectItem value="h2">Second half (Jul–Dec)</SelectItem>
                <SelectItem value="q1">Quarter 1</SelectItem>
                <SelectItem value="q2">Quarter 2</SelectItem>
                <SelectItem value="q3">Quarter 3</SelectItem>
                <SelectItem value="q4">Quarter 4</SelectItem>
                <SelectItem value="custom">Custom months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Chart focus</Label>
            <Select value={metric} onValueChange={(value) => setMetric(value as ComparisonMetric)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="net">Net cash flow</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expenses">Expenses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Categories shown</Label>
            <Select value={String(categoryLimit)} onValueChange={(value) => setCategoryLimit(Number(value))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Top 5</SelectItem>
                <SelectItem value="8">Top 8</SelectItem>
                <SelectItem value="12">Top 12</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="flex h-10 w-full items-center justify-between rounded-lg border bg-muted/40 px-3">
              <Label htmlFor="cumulative-view" className="cursor-pointer">Cumulative chart</Label>
              <Switch id="cumulative-view" checked={cumulative} onCheckedChange={setCumulative} />
            </div>
          </div>
          {rangePreset === "custom" && (
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 xl:col-span-5 xl:max-w-xl">
              <div className="space-y-2">
                <Label>Starting month</Label>
                <Select value={String(startMonth)} onValueChange={(value) => setStartMonth(Number(value))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index)}>{month}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ending month</Label>
                <Select value={String(endMonth)} onValueChange={(value) => setEndMonth(Number(value))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index)}>{month}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border bg-card px-4 py-3">
          <span className="font-semibold text-primary">{activeYear}</span>
          <span className="ml-2 text-muted-foreground">{primaryRangeLabel}</span>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <span className="font-semibold text-brand-navy dark:text-brand-tint">{selectedComparisonYear}</span>
          <span className="ml-2 text-muted-foreground">{comparisonRangeLabel}</span>
        </div>
      </div>

      {!hasAnyData && (
        <Card className="border-dashed bg-secondary/25">
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <BarChart3 className="h-8 w-8 text-primary" />
            <p className="font-headline font-semibold">No transactions in either selected period</p>
            <p className="max-w-lg text-sm text-muted-foreground">Choose another comparison year or period. Once transactions exist, every chart and insight on this page updates automatically.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Net cash flow" primary={analytics.primary.net} comparison={analytics.comparison.net} delta={analytics.deltas.net} primaryYear={activeYear} comparisonYear={selectedComparisonYear} />
        <MetricCard title="Income" primary={analytics.primary.income} comparison={analytics.comparison.income} delta={analytics.deltas.income} primaryYear={activeYear} comparisonYear={selectedComparisonYear} />
        <MetricCard title="Expenses" primary={analytics.primary.expenses} comparison={analytics.comparison.expenses} delta={analytics.deltas.expenses} primaryYear={activeYear} comparisonYear={selectedComparisonYear} inverse />
        <MetricCard title="Savings rate" primary={analytics.primary.savingsRate} comparison={analytics.comparison.savingsRate} delta={analytics.deltas.savingsRate} primaryYear={activeYear} comparisonYear={selectedComparisonYear} format={formatPercent} />
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{cumulative ? "Cumulative" : "Monthly"} {metric === "net" ? "net cash flow" : metric}</CardTitle>
            <CardDescription>Solid emerald is {activeYear}; dashed navy is {selectedComparisonYear}.</CardDescription>
          </div>
          <TrendingUp className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <ComparisonTrendChart data={analytics.monthly} primaryYear={activeYear} comparisonYear={selectedComparisonYear} metric={metric} cumulative={cumulative} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Category movement</CardTitle>
            <CardDescription>See where the composition of your money changed, not just the total.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="expenses">
              <TabsList className="mb-6 grid w-full grid-cols-2 sm:w-80">
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
              </TabsList>
              <TabsContent value="expenses">
                <CategoryBreakdown data={analytics.expenseCategories} primaryYear={activeYear} comparisonYear={selectedComparisonYear} limit={categoryLimit} inverse />
              </TabsContent>
              <TabsContent value="income">
                <CategoryBreakdown data={analytics.incomeCategories} primaryYear={activeYear} comparisonYear={selectedComparisonYear} limit={categoryLimit} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="brand-surface text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white"><Lightbulb className="h-5 w-5 text-brand-tint" /> What changed</CardTitle>
              <CardDescription className="text-white/70">Automatic signals from the selected period.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-xl bg-white/10 p-4">
                <p className="font-semibold">Monthly momentum</p>
                <p className="mt-1 text-white/75">{activeYear} produced stronger net cash flow in {analytics.monthsWon} of {analytics.monthsCompared} matching months.</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4">
                <p className="font-semibold">Spending direction</p>
                <p className="mt-1 text-white/75">Expenses are {currency.format(Math.abs(analytics.deltas.expenses.value))} {analytics.deltas.expenses.value <= 0 ? "lower" : "higher"} than {selectedComparisonYear}.</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4">
                <p className="font-semibold">Largest category mover</p>
                <p className="mt-1 text-white/75">{largestExpenseMover ? `${largestExpenseMover.category} changed by ${currency.format(Math.abs(largestExpenseMover.delta))}.` : "Add categorized expenses to reveal the biggest driver."}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-primary" /> Activity detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3"><span className="text-sm text-muted-foreground">Transactions</span><span className="font-mono font-semibold">{integer.format(analytics.primary.transactionCount)} <span className="text-xs font-normal text-muted-foreground">vs {integer.format(analytics.comparison.transactionCount)}</span></span></div>
              <div className="flex items-center justify-between border-b pb-3"><span className="text-sm text-muted-foreground">Average transaction</span><span className="font-mono font-semibold">{currency.format(analytics.primary.averageTransaction)}</span></div>
              <div className="flex items-center justify-between border-b pb-3"><span className="text-sm text-muted-foreground">Average monthly net</span><span className="font-mono font-semibold">{currency.format(analytics.primary.averageMonthlyNet)}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Largest expense</span><span className="max-w-[55%] truncate text-right text-sm font-semibold">{analytics.primary.largestExpense ? `${analytics.primary.largestExpense.description} · ${currency.format(analytics.primary.largestExpense.amount)}` : "None"}</span></div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/25">
            <CardContent className="flex items-start gap-3 p-5">
              {analytics.deltas.net.value >= 0 ? <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
              <div><p className="text-sm font-semibold">Bottom line</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Net cash flow is {currency.format(Math.abs(analytics.deltas.net.value))} {analytics.deltas.net.value >= 0 ? "ahead of" : "behind"} the matching {selectedComparisonYear} period.</p></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
