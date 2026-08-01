
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useCategories } from '@/hooks/use-categories';
import { useTransactionRange } from '@/hooks/use-transactions';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  PieChart as PieChartIcon, 
  TrendingUp,
  ArrowUp,
  ArrowDown,
  BookMarked,
  Filter,
  Trash2,
  CalendarCheck,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import type { QuarterlyReport } from '@/types';
import { DateRange } from 'react-day-picker';
import {
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
  getQuarter,
  getYear,
  format,
  parseISO,
} from 'date-fns';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table"
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableMultiSelect } from '@/components/ui/searchable-multi-select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { findMainCategoryForTransaction } from '@/lib/category-tree';
import {
  parseTransactionDate,
  summarizeTransactions,
  transactionAmount,
} from '@/lib/financial-summary';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts } from '@/hooks/use-accounts';

const OverviewChart = dynamic(
  () =>
    import('@/components/dashboard/overview-chart').then(
      (module) => module.OverviewChart,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full" />,
  },
);

const CategoryPieChart = dynamic(
  () =>
    import('@/components/reports/category-pie-chart').then(
      (module) => module.CategoryPieChart,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full" />,
  },
);

const ExportReportDialog = dynamic(
  () =>
    import('@/components/reports/export-report-dialog').then(
      (module) => module.ExportReportDialog,
    ),
  { ssr: false },
);

const ExportQuarterlyReportDialog = dynamic(
  () =>
    import('@/components/reports/export-quarterly-report-dialog').then(
      (module) => module.ExportQuarterlyReportDialog,
    ),
  { ssr: false },
);

const GenerateQuarterlyReportDialog = dynamic(
  () =>
    import('@/components/reports/generate-quarterly-report-dialog').then(
      (module) => module.GenerateQuarterlyReportDialog,
    ),
  { ssr: false },
);

const PRESET_RANGES = [
  { label: 'This Month', value: 'this-month' },
  { label: 'Last Month', value: 'last-month' },
  { label: 'This Year', value: 'this-year' },
  { label: 'Year to Date', value: 'year-to-date' },
  { label: 'First Half (Jan–Jun)', value: 'first-half' },
  { label: 'Second Half (Jul–Dec)', value: 'second-half' },
  { label: 'Last 30 Days', value: 'last-30' },
  { label: 'Last 90 Days', value: 'last-90' },
  { label: 'Q1', value: 'q1' },
  { label: 'Q2', value: 'q2' },
  { label: 'Q3', value: 'q3' },
  { label: 'Q4', value: 'q4' },
];

const quarterlyPeriodSortValue = (period: string) => {
  const match = /^Q([1-4])\s+(\d{4})$/.exec(period);
  return match ? Number(match[2]) * 10 + Number(match[1]) : 0;
};

const formatStoredReportDate = (value: string) =>
  format(parseISO(value.slice(0, 10)), 'MMM d, yyyy');

function ReportView({ period }: { period: 'monthly' | 'yearly' }) {
  const { categories } = useCategories();
  const { activeYear } = useAuth();
  const isMobile = useIsMobile();
  
  const defaultDateRange = useMemo(() => {
    const baseDate = new Date(activeYear, new Date().getMonth(), 1);
    if (period === 'monthly') {
      return {
        from: startOfMonth(baseDate),
        to: endOfMonth(baseDate),
      };
    } else {
      return {
        from: startOfYear(baseDate),
        to: endOfYear(baseDate),
      };
    }
  }, [period, activeYear]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultDateRange);
  const [selectedIncomeCategories, setSelectedIncomeCategories] = useState<string[]>([]);
  const [selectedExpenseCategories, setSelectedExpenseCategories] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(true);
  
  useEffect(() => {
    setDateRange(defaultDateRange);
  }, [activeYear, defaultDateRange]);

  const handlePresetChange = (value: string) => {
    const now = new Date();
    // Use activeYear for calculations, but retain current month/day for presets like "This Month"
    const baseDate = new Date(activeYear, now.getMonth(), now.getDate());
    const currentYear = activeYear;

    let fromDate: Date;
    let toDate: Date;
    switch (value) {
      case 'this-month':
        fromDate = startOfMonth(baseDate);
        toDate = endOfMonth(baseDate);
        break;
      case 'last-month':
        const lastMonth = subMonths(baseDate, 1);
        fromDate = startOfMonth(lastMonth);
        toDate = endOfMonth(lastMonth);
        break;
      case 'this-year':
         fromDate = startOfYear(baseDate);
         toDate = endOfYear(baseDate);
        break;
      case 'year-to-date':
        fromDate = startOfYear(baseDate);
        toDate = baseDate;
        break;
      case 'first-half':
        fromDate = new Date(currentYear, 0, 1);
        toDate = new Date(currentYear, 5, 30);
        break;
      case 'second-half':
        fromDate = new Date(currentYear, 6, 1);
        toDate = new Date(currentYear, 11, 31);
        break;
      case 'last-30':
         fromDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 29);
         toDate = baseDate;
        break;
      case 'last-90':
        fromDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 89);
        toDate = baseDate;
        break;
      case 'q1':
        fromDate = new Date(currentYear, 0, 1);
        toDate = new Date(currentYear, 2, 31);
        break;
      case 'q2':
        fromDate = new Date(currentYear, 3, 1);
        toDate = new Date(currentYear, 5, 30);
        break;
      case 'q3':
        fromDate = new Date(currentYear, 6, 1);
        toDate = new Date(currentYear, 8, 30);
        break;
      case 'q4':
        fromDate = new Date(currentYear, 9, 1);
        toDate = new Date(currentYear, 11, 31);
        break;
      default:
        return;
    }
    setDateRange({ from: fromDate, to: toDate });
  };

  const transactionRange = useMemo(
    () => ({
      from: dateRange?.from ?? defaultDateRange.from,
      to: dateRange?.to ?? dateRange?.from ?? defaultDateRange.to,
    }),
    [dateRange, defaultDateRange],
  );
  const {
    transactions: dateFilteredTransactions,
    loading: transactionLoading,
    error: transactionError,
  } = useTransactionRange(transactionRange);

  const { totalIncome, totalExpenses, netIncome } = useMemo(() => {
    const includedTransactions = dateFilteredTransactions.filter(t => {
      if (t.type === "transfer") return false;
      const selectedCategories = t.type === 'income'
        ? selectedIncomeCategories
        : selectedExpenseCategories;
      if (selectedCategories.length === 0) return true;
      const main = findMainCategoryForTransaction(t, categories);
      return selectedCategories.includes(main);
    });
    const summary = summarizeTransactions(includedTransactions);

    return {
      totalIncome: summary.income,
      totalExpenses: summary.expenses,
      netIncome: summary.net,
    };
  }, [dateFilteredTransactions, selectedIncomeCategories, selectedExpenseCategories, categories]);

  
  const getCategoryOptions = useCallback((type: 'income' | 'expense') => {
    const mainCategories = categories.filter(c => c.type === type);
    return mainCategories.map(c => ({ value: c.name, label: c.name }));
  }, [categories]);

  const expenseByCategory = useMemo(() => {
    const data: { [key: string]: number } = {};
    const filteredTransactions = dateFilteredTransactions.filter(t => t.type === 'expense');

    if (selectedExpenseCategories.length === 1) {
      // Drill-down view: show sub-categories of the selected main category
      const mainCatName = selectedExpenseCategories[0];
      const mainCat = categories.find(c => c.name === mainCatName);
      
      const transactionsForMainCategory = filteredTransactions.filter(t => findMainCategoryForTransaction(t, categories) === mainCatName);

      transactionsForMainCategory.forEach(t => {
          const isMain = t.category === mainCatName;
          const subCategory = mainCat?.subCategories?.find(sc => sc.name === t.category);
          
          if (isMain && (!mainCat?.subCategories || mainCat.subCategories.length === 0)) { // Main cat with no subs
              data[t.category] = (data[t.category] || 0) + transactionAmount(t);
          } else if (subCategory) { // Is a direct subcategory
              data[t.category] = (data[t.category] || 0) + transactionAmount(t);
          } else if (!isMain) { // Could be a sub-sub-category
             data[t.category] = (data[t.category] || 0) + transactionAmount(t);
          }
      });
      // If no sub-category transactions, show total for main category
      if (Object.keys(data).length === 0 && transactionsForMainCategory.length > 0) {
        data[mainCatName] = transactionsForMainCategory.reduce((acc, t) => acc + transactionAmount(t), 0);
      }


    } else {
      // Default view: show main categories
      filteredTransactions
        .filter(t => {
          const mainCategory = findMainCategoryForTransaction(t, categories);
          return selectedExpenseCategories.length === 0 || selectedExpenseCategories.includes(mainCategory);
        })
        .forEach(t => {
          const mainCategory = findMainCategoryForTransaction(t, categories);
          data[mainCategory] = (data[mainCategory] || 0) + transactionAmount(t);
        });
    }
  
    return Object.entries(data)
      .map(([name, amount]) => ({ category: name, amount: amount, }))
      .sort((a, b) => b.amount - a.amount);
  }, [dateFilteredTransactions, categories, selectedExpenseCategories]);
  
  const incomeByCategory = useMemo(() => {
    const data: { [key: string]: number } = {};
    const filteredTransactions = dateFilteredTransactions.filter(t => t.type === 'income');
  
    if (selectedIncomeCategories.length === 1) {
      // Drill-down view
      const mainCatName = selectedIncomeCategories[0];
      const mainCat = categories.find(c => c.name === mainCatName);

      const transactionsForMainCategory = filteredTransactions.filter(t => findMainCategoryForTransaction(t, categories) === mainCatName);

      transactionsForMainCategory.forEach(t => {
          const isMain = t.category === mainCatName;
          const subCategory = mainCat?.subCategories?.find(sc => sc.name === t.category);

          if (isMain && (!mainCat?.subCategories || mainCat.subCategories.length === 0)) {
              data[t.category] = (data[t.category] || 0) + transactionAmount(t);
          } else if (subCategory) {
              data[t.category] = (data[t.category] || 0) + transactionAmount(t);
          } else if (!isMain) {
             data[t.category] = (data[t.category] || 0) + transactionAmount(t);
          }
      });
      if (Object.keys(data).length === 0 && transactionsForMainCategory.length > 0) {
        data[mainCatName] = transactionsForMainCategory.reduce((acc, t) => acc + transactionAmount(t), 0);
      }

    } else {
      // Default view
      filteredTransactions
        .filter(t => {
          const mainCategory = findMainCategoryForTransaction(t, categories);
          return selectedIncomeCategories.length === 0 || selectedIncomeCategories.includes(mainCategory);
        })
        .forEach(t => {
          const mainCategory = findMainCategoryForTransaction(t, categories);
          data[mainCategory] = (data[mainCategory] || 0) + transactionAmount(t);
        });
    }
  
    return Object.entries(data)
      .map(([name, amount]) => ({ category: name, amount: amount, }))
      .sort((a, b) => b.amount - a.amount);
  }, [dateFilteredTransactions, categories, selectedIncomeCategories]);

  const { overviewData, trendStats } = useMemo(() => {
    const dataByPeriod: { [key: string]: { name: string; income: number; expense: number } } = {};
    dateFilteredTransactions.forEach(t => {
      if (t.type === "transfer") return;
      const tDate = parseTransactionDate(t.date);
      if (!tDate) return;
      
      let periodKey, periodLabel;
      if (period === 'monthly') {
          periodKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}-${String(tDate.getDate()).padStart(2, '0')}`;
          periodLabel = tDate.toLocaleString('en', { day: 'numeric', month: 'short' });
      } else { // yearly
          periodKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
          periodLabel = tDate.toLocaleString('en', { month: 'short', year: '2-digit' });
      }

      if (!dataByPeriod[periodKey]) {
        dataByPeriod[periodKey] = { name: periodLabel, income: 0, expense: 0 };
      }
      dataByPeriod[periodKey][t.type] += transactionAmount(t);
    });

    const sortedData = Object.values(dataByPeriod).sort((a, b) => new Date(a.name) > new Date(b.name) ? 1 : -1);
    const n = sortedData.length;

    if (n < 2) return { overviewData: sortedData, trendStats: { income: 0, expense: 0 } };

    // Linear regression calculation
    const calculateTrend = (data: number[]) => {
      const sumX = (n * (n - 1)) / 2;
      const sumY = data.reduce((a, b) => a + b, 0);
      const sumXY = data.reduce((sum, y, i) => sum + i * y, 0);
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
      
      if (n * sumX2 - sumX * sumX === 0) {
        return { m: 0, c: sumY / n, change: 0 };
      }

      const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const c = (sumY - m * sumX) / n;
      
      const firstVal = data[0];
      const lastVal = data[n - 1];
      const change = firstVal !== 0 ? ((lastVal - firstVal) / firstVal) * 100 : (lastVal > 0 ? 100 : 0);

      return { m, c, change };
    };

    const incomeTrend = calculateTrend(sortedData.map(d => d.income));
    const expenseTrend = calculateTrend(sortedData.map(d => d.expense));
    
    const dataWithTrend = sortedData.map((d, i) => ({
      ...d,
      incomeTrend: incomeTrend.m * i + incomeTrend.c,
      expenseTrend: expenseTrend.m * i + expenseTrend.c,
    }));

    return { 
      overviewData: dataWithTrend, 
      trendStats: {
        income: isFinite(incomeTrend.change) ? incomeTrend.change : 0,
        expense: isFinite(expenseTrend.change) ? expenseTrend.change : 0,
      } 
    };
  }, [dateFilteredTransactions, period]);

  const incomeTransactionsForExport = useMemo(() => {
    return dateFilteredTransactions.filter(t => {
        if (t.type !== 'income') return false;
        if (selectedIncomeCategories.length === 0) return true;
        const mainCategory = findMainCategoryForTransaction(t, categories);
        return selectedIncomeCategories.includes(mainCategory);
    });
  }, [dateFilteredTransactions, selectedIncomeCategories, categories]);

  const expenseTransactionsForExport = useMemo(() => {
      return dateFilteredTransactions.filter(t => {
          if (t.type !== 'expense') return false;
          if (selectedExpenseCategories.length === 0) return true;
          const mainCategory = findMainCategoryForTransaction(t, categories);
          return selectedExpenseCategories.includes(mainCategory);
      });
  }, [dateFilteredTransactions, selectedExpenseCategories, categories]);


  if (transactionLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading report data">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (transactionError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Report data is temporarily unavailable. Please try again.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
       <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} asChild>
        <Card>
            <CardHeader className="py-4">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="-mx-2 flex h-auto w-[calc(100%+1rem)] justify-between px-2 py-1 text-left"
                  aria-label={`${filtersOpen ? 'Hide' : 'Show'} report filters`}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Filter className="h-4 w-4" />
                    Filters
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      filtersOpen && "rotate-180"
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                 <div className="space-y-2">
                    <Label className="text-sm">Date Range</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Select onValueChange={handlePresetChange}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Select a preset" />
                            </SelectTrigger>
                            <SelectContent>
                                {PRESET_RANGES.map(preset => (
                                    <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn('min-w-0 flex-1 justify-start overflow-hidden text-left font-normal', !dateRange && 'text-muted-foreground')}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    <span className="truncate">
                                      {dateRange?.from ? (dateRange.to ? (`${format(dateRange.from, 'LLL dd, y')} - ${format(dateRange.to, 'LLL dd, y')}`) : format(dateRange.from, 'LLL dd, y')) : 'Pick a date'}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={isMobile ? 1 : 2}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </CardContent>
            </CollapsibleContent>
        </Card>
       </Collapsible>
        <Card id="overview-chart-card">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl"><TrendingUp className="h-5 w-5 shrink-0"/> Income vs. Expense Overview</CardTitle>
              <CardDescription>
                A summary of your cash flow for the selected period.
              </CardDescription>
            </div>
            <div className="w-full sm:w-auto [&>button]:w-full">
              <ExportReportDialog
                transactions={dateFilteredTransactions}
                dateRange={dateRange}
                chartId="overview-chart-card"
                chartTitle="Income vs Expense Overview"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid grid-cols-1 gap-3 border-b pb-4 min-[440px]:grid-cols-3">
              <div className="rounded-lg bg-muted/30 p-3 text-center min-[440px]:rounded-none min-[440px]:bg-transparent min-[440px]:p-0">
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="break-words text-xl font-bold text-emerald-500 sm:text-2xl">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalIncome)}</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center min-[440px]:rounded-none min-[440px]:bg-transparent min-[440px]:p-0">
                <p className="text-sm text-muted-foreground">Total Expense</p>
                <p className="break-words text-xl font-bold text-red-500 sm:text-2xl">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalExpenses)}</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center min-[440px]:rounded-none min-[440px]:bg-transparent min-[440px]:p-0">
                <p className="text-sm text-muted-foreground">Net Income</p>
                <p className={cn("break-words text-xl font-bold sm:text-2xl", netIncome >= 0 ? "text-foreground" : "text-destructive")}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(netIncome)}</p>
              </div>
            </div>
            <OverviewChart data={overviewData} />
          </CardContent>
          {overviewData.length > 1 && (
             <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 font-medium leading-none">
                    Trending Income:
                    {trendStats.income >= 0 ? <ArrowUp className="h-4 w-4 text-emerald-500" /> : <ArrowDown className="h-4 w-4 text-red-500" />}
                     <span className={cn(trendStats.income >= 0 ? "text-emerald-500" : "text-red-500")}>
                        {trendStats.income.toFixed(1)}%
                    </span>
                </div>
                 <div className="flex gap-2 font-medium leading-none">
                     Trending Expense:
                    {trendStats.expense >= 0 ? <ArrowUp className="h-4 w-4 text-red-500" /> : <ArrowDown className="h-4 w-4 text-emerald-500" />}
                     <span className={cn(trendStats.expense >= 0 ? "text-red-500" : "text-emerald-500")}>
                        {trendStats.expense.toFixed(1)}%
                    </span>
                </div>
                 <div className="leading-none text-muted-foreground">
                    Change over the selected period.
                </div>
            </CardFooter>
          )}
        </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card id="income-breakdown-card">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl"><PieChartIcon className="h-5 w-5 shrink-0"/> Income Breakdown</CardTitle>
                <CardDescription>
                  Where your income comes from. Select a single category to see sub-category details.
                </CardDescription>
              </div>
              <div className="w-full sm:w-auto [&>button]:w-full">
                <ExportReportDialog
                  transactions={incomeTransactionsForExport}
                  dateRange={dateRange}
                  chartId="income-breakdown-card"
                  chartTitle="Income Breakdown"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4 border-b pb-2">
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="text-xl font-bold text-emerald-500">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalIncome)}</p>
            </div>
             <div className="p-4 border rounded-md">
                 <Label className="text-sm mb-2 block">Filter Categories</Label>
                 <SearchableMultiSelect
                    options={getCategoryOptions('income')}
                    selected={selectedIncomeCategories}
                    onChange={setSelectedIncomeCategories}
                    placeholder="All Income Categories"
                />
            </div>
            <CategoryPieChart data={incomeByCategory} />
          </CardContent>
        </Card>
        <Card id="expense-breakdown-card">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl"><PieChartIcon className="h-5 w-5 shrink-0"/> Expense Breakdown</CardTitle>
                <CardDescription>
                  Where your money is going. Select a single category to see sub-category details.
                </CardDescription>
              </div>
              <div className="w-full sm:w-auto [&>button]:w-full">
                <ExportReportDialog
                  transactions={expenseTransactionsForExport}
                  dateRange={dateRange}
                  chartId="expense-breakdown-card"
                  chartTitle="Expense Breakdown"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4 border-b pb-2">
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-xl font-bold text-red-500">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalExpenses)}</p>
            </div>
            <div className="p-4 border rounded-md">
                <Label className="text-sm mb-2 block">Filter Categories</Label>
                <SearchableMultiSelect
                    options={getCategoryOptions('expense')}
                    selected={selectedExpenseCategories}
                    onChange={setSelectedExpenseCategories}
                    placeholder="All Expense Categories"
                />
            </div>
            <CategoryPieChart data={expenseByCategory} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdvancedReportView() {
  const { user } = useAuth();
  const {
    allAccountsSelected,
    selectedAccountIds,
  } = useAccounts();
  const { toast } = useToast();
  const [reports, setReports] = useState<QuarterlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<QuarterlyReport | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const reportsRef = collection(db, 'users', user.uid, 'reports');
    const unsubscribe = onSnapshot(
      reportsRef,
      (snapshot) => {
        const fetchedReports = snapshot.docs
          .map(reportDocument => ({
            ...reportDocument.data(),
            id: reportDocument.id,
          }) as QuarterlyReport)
          .sort(
            (a, b) =>
              quarterlyPeriodSortValue(b.period) -
                quarterlyPeriodSortValue(a.period) ||
              (a.accountLabel ?? "All accounts").localeCompare(
                b.accountLabel ?? "All accounts",
              )
          );
        setReports(fetchedReports);
        setSelectedReport((currentReport) => {
          if (fetchedReports.length === 0) return null;
          if (!currentReport) return fetchedReports[0];
          return fetchedReports.find(
            (report) => report.id === currentReport.id
          ) ?? fetchedReports[0];
        });
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to reports:', error);
        toast({
          variant: "destructive",
          title: "Error Loading Reports",
          description: error.message,
        });
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [user, toast]);

  const handleGenerateReport = async (
    referenceDate: Date,
    notes: string | undefined,
    budgetIds: string[]
  ) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to generate reports."
      });
      return false;
    }
    
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/reports/quarterly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          reportYear: getYear(referenceDate),
          quarter: getQuarter(referenceDate),
          startDate: startOfQuarter(referenceDate).toISOString(),
          endDate: endOfQuarter(referenceDate).toISOString(),
          notes,
          budgetIds,
          accountIds: allAccountsSelected
            ? undefined
            : selectedAccountIds,
        }),
      });
      const result = await response.json();

      if (response.ok && result.report) {
        toast({
          title: "Report Generated",
          description: `Generated ${result.report.period} for ${result.report.accountLabel ?? "all accounts"}.`
        });
        // This will be picked up by the onSnapshot listener, which will update the UI
        return true;
      } else {
        throw new Error(result.error || "Unknown error occurred.");
      }
    } catch (error: any) {
      console.error('Report generation error:', error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error.message || "An unexpected error occurred.",
      });
      return false;
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!user) return;
    const idToken = await user.getIdToken();
    const response = await fetch('/api/reports/quarterly', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ reportId }),
    });
    const result = await response.json();
    if (response.ok) {
      toast({
        title: "Report Deleted",
        description: `Report "${reportId}" has been deleted.`
      });
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
      }
    } else {
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: result.error || "An unexpected error occurred."
      });
    }
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const renderReportDetail = () => {
    if (!selectedReport) {
      return (
        <div className="flex flex-col items-center justify-center text-center h-full py-16">
          <BookMarked className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold">Select a report to view</h3>
          <p className="text-muted-foreground">Choose a generated report from the list to see its details.</p>
        </div>
      );
    }

    const incomeSummaryTotal = Object.values(
      selectedReport.incomeSummary
    ).reduce((sum, amount) => sum + amount, 0);
    const expenseSummaryTotal = Object.values(
      selectedReport.expenseSummary
    ).reduce((sum, amount) => sum + amount, 0);
    const totalIncome = selectedReport.totalIncome ?? incomeSummaryTotal;
    const totalExpenses = selectedReport.totalExpenses ?? expenseSummaryTotal;
    const transactionCount = selectedReport.transactionCount;
    const savingsRate =
      selectedReport.kpis.savingsRate ??
      (totalIncome > 0 ? (selectedReport.netIncome / totalIncome) * 100 : 0);
    const averageMonthlyNet =
      selectedReport.kpis.averageMonthlyNet ?? selectedReport.netIncome / 3;
    const averageTransaction =
      transactionCount && transactionCount > 0
        ? (totalIncome + totalExpenses) / transactionCount
        : null;
    const isReconciled =
      Math.abs(totalIncome - incomeSummaryTotal) < 0.01 &&
      Math.abs(totalExpenses - expenseSummaryTotal) < 0.01 &&
      Math.abs(totalIncome - totalExpenses - selectedReport.netIncome) < 0.01;
    const isCurrentCalculation =
      (selectedReport.calculationVersion ?? 0) >= 2;
    const reportDomId = `report-${selectedReport.id.replace(
      /[^a-zA-Z0-9_-]/g,
      "-",
    )}`;

    return (
      <Card id={reportDomId}>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-xl sm:text-2xl">Financial Report - {selectedReport.period}</CardTitle>
            <CardDescription>
              Generated on {format(new Date(selectedReport.createdAt.seconds * 1000), 'PPP')}
              {' · '}Covers {formatStoredReportDate(selectedReport.startDate)}–{formatStoredReportDate(selectedReport.endDate)}
            </CardDescription>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">
                {selectedReport.accountLabel ?? "All accounts"}
              </Badge>
              <Badge variant={isReconciled ? "secondary" : "destructive"}>
                {isReconciled ? "Totals reconciled" : "Totals need regeneration"}
              </Badge>
              {!isCurrentCalculation && (
                <Badge variant="outline">Legacy calculation · regenerate recommended</Badge>
              )}
            </div>
          </div>
          <div className="w-full sm:w-auto [&>button]:w-full">
            <ExportQuarterlyReportDialog
                reportId={reportDomId}
                reportTitle={`Financial Report - ${selectedReport.period} - ${selectedReport.accountLabel ?? "All accounts"}`}
              />
          </div>
        </CardHeader>
        <CardContent className="space-y-8 px-4 sm:px-6">
           {/* Executive Summary */}
           <div>
              <h3 className="text-lg font-semibold mb-2 border-b pb-2">Executive Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Income</CardTitle></CardHeader>
                      <CardContent><p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p></CardContent>
                  </Card>
                  <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Expenses</CardTitle></CardHeader>
                      <CardContent><p className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</p></CardContent>
                  </Card>
                  <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Net Income</CardTitle></CardHeader>
                      <CardContent>
                          <p className={cn("text-2xl font-bold", selectedReport.netIncome >= 0 ? "text-emerald-600" : "text-destructive")}>
                              {formatCurrency(selectedReport.netIncome)}
                          </p>
                      </CardContent>
                  </Card>
                   <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Savings Rate</CardTitle></CardHeader>
                      <CardContent>
                          <p className="text-2xl font-bold">{savingsRate.toFixed(1)}%</p>
                      </CardContent>
                  </Card>
              </div>
          </div>

          <div>
              <h3 className="text-lg font-semibold mb-2 border-b pb-2">Activity Snapshot</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Transactions</p><p className="mt-1 text-xl font-semibold">{transactionCount ?? 'Unavailable on legacy report'}</p></div>
                <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Average transaction</p><p className="mt-1 text-xl font-semibold">{averageTransaction === null ? 'Unavailable' : formatCurrency(averageTransaction)}</p></div>
                <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Average monthly net</p><p className="mt-1 text-xl font-semibold">{formatCurrency(averageMonthlyNet)}</p></div>
              </div>
          </div>
          
           {/* Income Statement */}
          <div>
            <h3 className="text-lg font-semibold mb-2 border-b pb-2">Income Statement</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-medium mb-2">Income</h4>
                  <Table>
                    <TableBody>
                        {Object.entries(selectedReport.incomeSummary).map(([cat, amt]) => (
                            <TableRow key={cat}><TableCell>{cat}</TableCell><TableCell className="text-right">{formatCurrency(amt as number)}</TableCell></TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
                 <div>
                  <h4 className="font-medium mb-2">Expenses</h4>
                  <Table>
                    <TableBody>
                        {Object.entries(selectedReport.expenseSummary).map(([cat, amt]) => (
                            <TableRow key={cat}><TableCell>{cat}</TableCell><TableCell className="text-right">{formatCurrency(amt as number)}</TableCell></TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
            </div>
             <div className="mt-4 border-t pt-4 flex justify-between font-bold text-lg">
                <span>Net Income</span>
                <span className={cn(selectedReport.netIncome >= 0 ? "text-emerald-600" : "text-destructive")}>{formatCurrency(selectedReport.netIncome)}</span>
            </div>
          </div>

          {/* Budget vs Actual */}
          {selectedReport.budgetComparison && selectedReport.budgetComparison.length > 0 && (
            <div>
                <h3 className="text-lg font-semibold mb-2 border-b pb-2">Budget vs. Actual</h3>
                <div className="space-y-3 sm:hidden">
                  {selectedReport.budgetComparison.map((item) => (
                    <div key={item.categoryName} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.categoryName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatCurrency(item.actual)} of {formatCurrency(item.budget)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            item.variance >= 0 ? "text-emerald-600" : "text-destructive"
                          )}
                        >
                          {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <Progress
                          value={Math.min(item.percentUsed, 100)}
                          className={cn("h-2 flex-1", {
                            '[&>div]:bg-destructive': item.percentUsed > 100,
                          })}
                        />
                        <span className="w-12 text-right text-xs font-medium tabular-nums">
                          {item.percentUsed.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {selectedReport.budgetComparisonTotals && (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">Total</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatCurrency(selectedReport.budgetComparisonTotals.actual)} of {formatCurrency(selectedReport.budgetComparisonTotals.budget)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            selectedReport.budgetComparisonTotals.variance >= 0 ? "text-emerald-600" : "text-destructive"
                          )}
                        >
                          {selectedReport.budgetComparisonTotals.variance >= 0 ? '+' : ''}{formatCurrency(selectedReport.budgetComparisonTotals.variance)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <Progress
                          value={Math.min(selectedReport.budgetComparisonTotals.percentUsed, 100)}
                          className={cn("h-2 flex-1", {
                            '[&>div]:bg-destructive': selectedReport.budgetComparisonTotals.percentUsed > 100,
                          })}
                        />
                        <span className="w-12 text-right text-xs font-semibold tabular-nums">
                          {selectedReport.budgetComparisonTotals.percentUsed.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="hidden overflow-x-auto sm:block">
                  <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Budget</TableHead>
                            <TableHead className="text-right">Actual</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">Variance</TableHead>
                            <TableHead className="text-right">% Used</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {selectedReport.budgetComparison.map(item => (
                            <TableRow key={item.categoryName}>
                                <TableCell>{item.categoryName}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.budget)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.actual)}</TableCell>
                                <TableCell className={cn("text-right hidden sm:table-cell", item.variance >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                                    {formatCurrency(item.variance)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <span>{item.percentUsed.toFixed(0)}%</span>
                                        <Progress
                                            value={Math.min(item.percentUsed, 100)}
                                            className={cn("w-12 sm:w-20 h-2", {
                                                '[&>div]:bg-destructive': item.percentUsed > 100,
                                            })}
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    {selectedReport.budgetComparisonTotals && (
                       <TableFooter>
                            <TableRow>
                                <TableCell className="font-bold">Total</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(selectedReport.budgetComparisonTotals.budget)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(selectedReport.budgetComparisonTotals.actual)}</TableCell>
                                <TableCell className={cn("text-right font-bold hidden sm:table-cell", selectedReport.budgetComparisonTotals.variance >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                                    {formatCurrency(selectedReport.budgetComparisonTotals.variance)}
                                </TableCell>
                                <TableCell className="text-right font-bold">
                                     <div className="flex items-center justify-end gap-2">
                                        <span>{selectedReport.budgetComparisonTotals.percentUsed.toFixed(0)}%</span>
                                        <Progress
                                            value={Math.min(selectedReport.budgetComparisonTotals.percentUsed, 100)}
                                            className={cn("w-12 sm:w-20 h-2", {
                                                '[&>div]:bg-destructive': selectedReport.budgetComparisonTotals.percentUsed > 100,
                                            })}
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    )}
                  </Table>
                </div>
            </div>
          )}

           {/* Goals Progress */}
          {selectedReport.goalsProgress && selectedReport.goalsProgress.length > 0 && (
            <div>
                <h3 className="text-lg font-semibold mb-1 border-b pb-2">Goals Snapshot</h3>
                <p className="mb-3 text-sm text-muted-foreground">Goal balances as they existed when this report was generated.</p>
                <div className="space-y-3 sm:hidden">
                  {selectedReport.goalsProgress.map((item) => (
                    <div key={item.name} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatCurrency(item.savedAmount)} saved of {formatCurrency(item.targetAmount)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {item.progress.toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={item.progress} className="mt-3 h-2 [&>div]:bg-primary"/>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto sm:block">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Goal</TableHead>
                            <TableHead className="text-right">Saved</TableHead>
                            <TableHead className="text-right">Target</TableHead>
                            <TableHead className="text-right">Progress</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {selectedReport.goalsProgress.map(item => (
                            <TableRow key={item.name}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.savedAmount)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.targetAmount)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <span>{item.progress.toFixed(0)}%</span>
                                        <Progress value={item.progress} className="w-12 sm:w-20 h-2 [&>div]:bg-primary"/>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </div>
            </div>
          )}

          {/* KPIs */}
          <div>
              <h3 className="text-lg font-semibold mb-2 border-b pb-2">Key Performance Indicators (KPIs)</h3>
               <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>KPI</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell>Profit Margin</TableCell>
                        <TableCell className="text-right">{selectedReport.kpis.profitMargin.toFixed(1)}%</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>Expense-to-Income Ratio</TableCell>
                        <TableCell className="text-right">{selectedReport.kpis.expenseToIncomeRatio.toFixed(1)}%</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>Savings Rate</TableCell>
                        <TableCell className="text-right">{savingsRate.toFixed(1)}%</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>Average Monthly Net</TableCell>
                        <TableCell className="text-right">{formatCurrency(averageMonthlyNet)}</TableCell>
                    </TableRow>
                </TableBody>
               </Table>
          </div>

          {/* Notes */}
          {selectedReport.notes && (
             <div>
                <h3 className="text-lg font-semibold mb-2 border-b pb-2">Notes</h3>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-md bg-muted/50 p-4 border">
                  {selectedReport.notes}
                </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-lg sm:text-xl"><CalendarCheck className="h-5 w-5 shrink-0"/> End of Year Report</CardTitle>
                    <CardDescription>A comprehensive summary of your financial activity over a full year.</CardDescription>
                </div>
                <Button asChild className="w-full sm:w-auto">
                    <Link href="/reports/eoy">View Report <ArrowRight className="ml-2 h-4 w-4"/></Link>
                </Button>
            </CardHeader>
        </Card>
        
        <div>
            <h3 className="text-lg font-semibold mb-4">Quarterly Reports</h3>
            <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <CardTitle>Generate Report</CardTitle>
                    <CardDescription>Create a financial snapshot for a specific quarter.</CardDescription>
                </div>
                <div className="w-full sm:w-auto [&>button]:w-full">
                  <GenerateQuarterlyReportDialog onGenerate={handleGenerateReport} />
                </div>
                </CardHeader>
            </Card>
        </div>


      <div className="grid grid-cols-1 gap-6 md:grid-cols-4 md:items-start">
        <Card className="md:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Choose a generated report</CardTitle>
            <CardDescription>Switch reports without leaving the details view.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            {loading ? (
              <div className="py-2 text-sm text-muted-foreground">Loading reports...</div>
            ) : reports.length === 0 ? (
              <div className="py-2 text-sm text-muted-foreground">No reports generated yet.</div>
            ) : (
              <>
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="mobile-report-selector">Report period</Label>
                  <Select
                    value={selectedReport?.id}
                    onValueChange={(reportId) => {
                      const report = reports.find((item) => item.id === reportId);
                      if (report) setSelectedReport(report);
                    }}
                  >
                    <SelectTrigger id="mobile-report-selector" className="w-full">
                      <SelectValue placeholder="Select a report" />
                    </SelectTrigger>
                    <SelectContent>
                      {reports.map((report) => (
                        <SelectItem key={report.id} value={report.id}>
                          {report.period} · {report.accountLabel ?? "All accounts"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedReport && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" aria-label={`Delete ${selectedReport.period}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the report for <strong>{selectedReport.period}</strong>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteReport(selectedReport.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete Report
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card className="hidden md:col-span-1 md:block">
          <CardHeader>
            <CardTitle>Generated Reports</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-muted-foreground">Loading reports...</div>
            ) : reports.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">No reports generated yet.</div>
            ) : (
              <div className="space-y-2">
                {reports.map(report => (
                  <div key={report.id} className="flex items-center gap-1 group">
                    <Button
                      variant={selectedReport?.id === report.id ? "secondary" : "ghost"}
                      className="w-full justify-start flex-1"
                      onClick={() => setSelectedReport(report)}
                    >
                      <span className="min-w-0 truncate text-left">
                        {report.period}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {report.accountLabel ?? "All accounts"}
                        </span>
                      </span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${report.period}`}
                          className="h-11 w-11 opacity-100 transition-opacity sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the report for <strong>{report.period}</strong>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteReport(report.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete Report
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <div className="min-w-0 md:col-span-3">
          {renderReportDetail()}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState('monthly');

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight font-headline sm:text-3xl">Reports</h2>
                     <p className="text-muted-foreground">
                        A summary of your financial activity.
                    </p>
                </div>
                <TabsList className="grid w-full grid-cols-3 sm:w-auto">
                    <TabsTrigger value="monthly" className="min-w-0">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly" className="min-w-0">Yearly</TabsTrigger>
                    <TabsTrigger value="advanced" className="min-w-0">Advanced</TabsTrigger>
                </TabsList>
            </div>
            {activeTab === 'monthly' && (
              <TabsContent value="monthly" className="pt-6">
                  <ReportView period="monthly" />
              </TabsContent>
            )}
            {activeTab === 'yearly' && (
              <TabsContent value="yearly" className="pt-6">
                  <ReportView period="yearly" />
              </TabsContent>
            )}
            {activeTab === 'advanced' && (
              <TabsContent value="advanced" className="pt-6">
                  <AdvancedReportView />
              </TabsContent>
            )}
        </Tabs>
    )
}

    
