

'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useUserData } from '@/hooks/use-user-data';
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
  Loader2,
  Filter,
} from 'lucide-react';
import type { Category, SubCategory, QuarterlyReport } from '@/types';
import { DateRange } from 'react-day-picker';
import { subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, getYear, format, startOfQuarter, endOfQuarter, subQuarters, getQuarter } from 'date-fns';

import { OverviewChart } from '@/components/dashboard/overview-chart';
import { CategoryPieChart } from '@/components/reports/category-pie-chart';
import { cn } from '@/lib/utils';
import { ExportReportDialog } from '@/components/reports/export-report-dialog';
import { generateAndSaveQuarterlyReport } from '@/lib/actions';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SearchableMultiSelect } from '@/components/ui/searchable-multi-select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';

const PRESET_RANGES = [
  { label: 'This Month', value: 'this-month' },
  { label: 'Last Month', value: 'last-month' },
  { label: 'This Year', value: 'this-year' },
  { label: 'Last 30 Days', value: 'last-30' },
  { label: 'Last 90 Days', value: 'last-90' },
  { label: 'Q1', value: 'q1' },
  { label: 'Q2', value: 'q2' },
  { label: 'Q3', value: 'q3' },
  { label: 'Q4', value: 'q4' },
];

function ReportView({ period }: { period: 'monthly' | 'yearly' }) {
  const { allTransactions, categories } = useUserData();
  
  const defaultDateRange = useMemo(() => {
    const now = new Date();
    if (period === 'monthly') {
      return {
        from: startOfMonth(now),
        to: endOfMonth(now),
      };
    } else {
      return {
        from: startOfYear(now),
        to: endOfYear(now),
      };
    }
  }, [period]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultDateRange);
  const [selectedIncomeCategories, setSelectedIncomeCategories] = useState<string[]>([]);
  const [selectedExpenseCategories, setSelectedExpenseCategories] = useState<string[]>([]);

  const handlePresetChange = (value: string) => {
    const now = new Date();
    const currentYear = getYear(now);
    let fromDate: Date;
    let toDate: Date;
    switch (value) {
      case 'this-month':
        fromDate = startOfMonth(now);
        toDate = endOfMonth(now);
        break;
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        fromDate = startOfMonth(lastMonth);
        toDate = endOfMonth(lastMonth);
        break;
      case 'this-year':
         fromDate = startOfYear(now);
         toDate = endOfYear(now);
        break;
      case 'last-30':
         fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
         toDate = now;
        break;
      case 'last-90':
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
        toDate = now;
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

  const dateFilteredTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return dateRange?.from && dateRange?.to
        ? transactionDate >= dateRange.from && transactionDate <= dateRange.to
        : true;
    });
  }, [allTransactions, dateRange]);

 const findMainCategory = useCallback((subCategoryName: string, allCategories: Category[]): string => {
    for (const mainCat of allCategories) {
        if (mainCat.name === subCategoryName) {
            return mainCat.name;
        }
        const findInSubs = (subs: SubCategory[], mainCatName: string): string | null => {
          for (const sub of subs) {
            if (sub.name === subCategoryName) return mainCatName;
            if (sub.subCategories) {
              const found = findInSubs(sub.subCategories, mainCatName);
              if (found) return found;
            }
          }
          return null;
        }
        if (mainCat.subCategories) {
            const found = findInSubs(mainCat.subCategories, mainCat.name);
            if (found) return found;
        }
    }
    return 'Uncategorized';
  }, []);

  const { totalIncome, totalExpenses, netIncome } = useMemo(() => {
    const income = dateFilteredTransactions
      .filter(t => t.type === 'income')
      .filter(t => {
        if (selectedIncomeCategories.length === 0) return true;
        const main = findMainCategory(t.category, categories);
        return selectedIncomeCategories.includes(main);
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = dateFilteredTransactions
      .filter(t => t.type === 'expense')
      .filter(t => {
        if (selectedExpenseCategories.length === 0) return true;
        const main = findMainCategory(t.category, categories);
        return selectedExpenseCategories.includes(main);
      })
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netIncome: income - expenses,
    };
  }, [dateFilteredTransactions, selectedIncomeCategories, selectedExpenseCategories, categories, findMainCategory]);

  
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
      
      const transactionsForMainCategory = filteredTransactions.filter(t => findMainCategory(t.category, categories) === mainCatName);

      transactionsForMainCategory.forEach(t => {
          const isMain = t.category === mainCatName;
          const subCategory = mainCat?.subCategories?.find(sc => sc.name === t.category);
          
          if (isMain && (!mainCat?.subCategories || mainCat.subCategories.length === 0)) { // Main cat with no subs
              data[t.category] = (data[t.category] || 0) + t.amount;
          } else if (subCategory) { // Is a direct subcategory
              data[t.category] = (data[t.category] || 0) + t.amount;
          } else if (!isMain) { // Could be a sub-sub-category
             data[t.category] = (data[t.category] || 0) + t.amount;
          }
      });
      // If no sub-category transactions, show total for main category
      if (Object.keys(data).length === 0 && transactionsForMainCategory.length > 0) {
        data[mainCatName] = transactionsForMainCategory.reduce((acc, t) => acc + t.amount, 0);
      }


    } else {
      // Default view: show main categories
      filteredTransactions
        .filter(t => {
          const mainCategory = findMainCategory(t.category, categories);
          return selectedExpenseCategories.length === 0 || selectedExpenseCategories.includes(mainCategory);
        })
        .forEach(t => {
          const mainCategory = findMainCategory(t.category, categories);
          data[mainCategory] = (data[mainCategory] || 0) + t.amount;
        });
    }
  
    return Object.entries(data)
      .map(([name, amount]) => ({ category: name, amount: amount, }))
      .sort((a, b) => b.amount - a.amount);
  }, [dateFilteredTransactions, categories, findMainCategory, selectedExpenseCategories]);
  
  const incomeByCategory = useMemo(() => {
    const data: { [key: string]: number } = {};
    const filteredTransactions = dateFilteredTransactions.filter(t => t.type === 'income');
  
    if (selectedIncomeCategories.length === 1) {
      // Drill-down view
      const mainCatName = selectedIncomeCategories[0];
      const mainCat = categories.find(c => c.name === mainCatName);

      const transactionsForMainCategory = filteredTransactions.filter(t => findMainCategory(t.category, categories) === mainCatName);

      transactionsForMainCategory.forEach(t => {
          const isMain = t.category === mainCatName;
          const subCategory = mainCat?.subCategories?.find(sc => sc.name === t.category);

          if (isMain && (!mainCat?.subCategories || mainCat.subCategories.length === 0)) {
              data[t.category] = (data[t.category] || 0) + t.amount;
          } else if (subCategory) {
              data[t.category] = (data[t.category] || 0) + t.amount;
          } else if (!isMain) {
             data[t.category] = (data[t.category] || 0) + t.amount;
          }
      });
      if (Object.keys(data).length === 0 && transactionsForMainCategory.length > 0) {
        data[mainCatName] = transactionsForMainCategory.reduce((acc, t) => acc + t.amount, 0);
      }

    } else {
      // Default view
      filteredTransactions
        .filter(t => {
          const mainCategory = findMainCategory(t.category, categories);
          return selectedIncomeCategories.length === 0 || selectedIncomeCategories.includes(mainCategory);
        })
        .forEach(t => {
          const mainCategory = findMainCategory(t.category, categories);
          data[mainCategory] = (data[mainCategory] || 0) + t.amount;
        });
    }
  
    return Object.entries(data)
      .map(([name, amount]) => ({ category: name, amount: amount, }))
      .sort((a, b) => b.amount - a.amount);
  }, [dateFilteredTransactions, categories, findMainCategory, selectedIncomeCategories]);

  const { overviewData, trendStats } = useMemo(() => {
    const dataByPeriod: { [key: string]: { name: string; income: number; expense: number } } = {};
    dateFilteredTransactions.forEach(t => {
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return;
      
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
      dataByPeriod[periodKey][t.type] += t.amount;
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
        const mainCategory = findMainCategory(t.category, categories);
        return selectedIncomeCategories.includes(mainCategory);
    });
  }, [dateFilteredTransactions, selectedIncomeCategories, findMainCategory, categories]);

  const expenseTransactionsForExport = useMemo(() => {
      return dateFilteredTransactions.filter(t => {
          if (t.type !== 'expense') return false;
          if (selectedExpenseCategories.length === 0) return true;
          const mainCategory = findMainCategory(t.category, categories);
          return selectedExpenseCategories.includes(mainCategory);
      });
  }, [dateFilteredTransactions, selectedExpenseCategories, findMainCategory, categories]);


  return (
    <div className="space-y-6">
       <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Filter className="h-4 w-4" />
                    Filters
                </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-sm">Date Range</Label>
                    <div className="flex gap-2">
                        <Select onValueChange={handlePresetChange}>
                            <SelectTrigger className="w-[180px]">
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
                                    className={cn('flex-1 justify-start text-left font-normal', !dateRange && 'text-muted-foreground')}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (dateRange.to ? (`${format(dateRange.from, 'LLL dd, y')} - ${format(dateRange.to, 'LLL dd, y')}`) : format(dateRange.from, 'LLL dd, y')) : (<span>Pick a date</span>)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </CardContent>
        </Card>
        <Card id="overview-chart-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><TrendingUp/> Income vs. Expense Overview</CardTitle>
              <CardDescription>
                A summary of your cash flow for the selected period.
              </CardDescription>
            </div>
            <ExportReportDialog 
              transactions={dateFilteredTransactions} 
              dateRange={dateRange} 
              chartId="overview-chart-card"
              chartTitle="Income vs Expense Overview"
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6 border-b pb-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="text-2xl font-bold text-emerald-500">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalIncome)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Expense</p>
                <p className="text-2xl font-bold text-red-500">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalExpenses)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Net Income</p>
                <p className={cn("text-2xl font-bold", netIncome >= 0 ? "text-foreground" : "text-destructive")}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(netIncome)}</p>
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
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2"><PieChartIcon/> Income Breakdown</CardTitle>
                <CardDescription>
                  Where your income comes from. Select a single category to see sub-category details.
                </CardDescription>
              </div>
               <ExportReportDialog 
                transactions={incomeTransactionsForExport} 
                dateRange={dateRange}
                chartId="income-breakdown-card"
                chartTitle="Income Breakdown"
              />
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
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2"><PieChartIcon/> Expense Breakdown</CardTitle>
                <CardDescription>
                  Where your money is going. Select a single category to see sub-category details.
                </CardDescription>
              </div>
              <ExportReportDialog 
                transactions={expenseTransactionsForExport} 
                dateRange={dateRange}
                chartId="expense-breakdown-card"
                chartTitle="Expense Breakdown"
              />
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

function GenerateReportDialog({
  onGenerate,
}: {
  onGenerate: (referenceDate: Date, notes?: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const currentYear = getYear(new Date());
  const currentQuarter = getQuarter(new Date());

  const [year, setYear] = useState(currentYear.toString());
  const [quarter, setQuarter] = useState(currentQuarter.toString());
  const [notes, setNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    // More precise quarter calculation
    const quarterMonth = (parseInt(quarter) - 1) * 3;
    const referenceDate = startOfQuarter(new Date(parseInt(year), quarterMonth, 1));
    
    await onGenerate(referenceDate, notes);

    setIsGenerating(false);
    setIsOpen(false);
    setNotes("");
  };

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Generate New Report</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Quarterly Report</DialogTitle>
          <DialogDescription>
            Select the period and add any notes for the report. It will be saved for future reference.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger id="year">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quarter">Quarter</Label>
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger id="quarter">
                  <SelectValue placeholder="Select quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
           <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any commentary or summary notes for this report..."
                rows={4}
              />
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function QuarterlyReportView() {
  const { user } = useAuth();
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
    const q = query(reportsRef, orderBy('period', 'desc'));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(`Received ${snapshot.docs.length} reports`);
        const fetchedReports = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Report data:', data);
          return data as QuarterlyReport;
        });
        setReports(fetchedReports);
        if (fetchedReports.length > 0 && !selectedReport) {
          setSelectedReport(fetchedReports[0]);
        }
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
  }, [user, toast, selectedReport]);

  const handleGenerateReport = async (referenceDate: Date, notes?: string) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to generate reports."
      });
      return;
    }
    
    console.log('Generating report with:', {
      userId: user.uid,
      referenceDate: referenceDate.toISOString(),
      quarter: getQuarter(referenceDate),
      year: getYear(referenceDate),
      notes
    });
    
    try {
      const result = await generateAndSaveQuarterlyReport({ 
        userId: user.uid, 
        referenceDate: referenceDate.toISOString(),
        notes: notes,
      });
      
      console.log('Report generation result:', result);
      
      if (result.success) {
        toast({
          title: "Report Generated",
          description: `Successfully generated report for ${result.report?.period}.`
        });
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
    }
  };

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

    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial Report - {selectedReport.period}</CardTitle>
          <CardDescription>Generated on {format(new Date(selectedReport.createdAt.seconds * 1000), 'PPP')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
           {/* Executive Summary */}
           <div>
              <h3 className="text-lg font-semibold mb-2 border-b pb-2">Executive Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Net Income</CardTitle></CardHeader>
                      <CardContent>
                          <p className={cn("text-2xl font-bold", selectedReport.netIncome >= 0 ? "text-emerald-600" : "text-destructive")}>
                              {formatCurrency(selectedReport.netIncome)}
                          </p>
                      </CardContent>
                  </Card>
                   <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Profit Margin</CardTitle></CardHeader>
                      <CardContent>
                          <p className="text-2xl font-bold">{selectedReport.kpis.profitMargin.toFixed(1)}%</p>
                      </CardContent>
                  </Card>
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
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Budget</TableHead>
                            <TableHead className="text-right">Actual</TableHead>
                            <TableHead className="text-right">Variance</TableHead>
                            <TableHead className="text-right">% Used</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {selectedReport.budgetComparison.map(item => (
                            <TableRow key={item.categoryName}>
                                <TableCell>{item.categoryName}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.budget)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.actual)}</TableCell>
                                <TableCell className={cn("text-right", item.variance >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                                    {formatCurrency(item.variance)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <span>{item.percentUsed.toFixed(0)}%</span>
                                        <Progress 
                                            value={item.percentUsed} 
                                            className={cn("w-20 h-2", {
                                                '[&>div]:bg-destructive': item.percentUsed > 100,
                                            })}
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
          )}

           {/* Goals Progress */}
          {selectedReport.goalsProgress && selectedReport.goalsProgress.length > 0 && (
            <div>
                <h3 className="text-lg font-semibold mb-2 border-b pb-2">Goals Progress</h3>
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
                                        <Progress value={item.progress} className="w-20 h-2 [&>div]:bg-primary"/>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
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
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Generate Report</CardTitle>
            <CardDescription>Create a financial snapshot for a specific quarter.</CardDescription>
          </div>
          <GenerateReportDialog onGenerate={handleGenerateReport} />
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        <Card className="md:col-span-1">
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
                  <Button
                    key={report.period}
                    variant={selectedReport?.period === report.period ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setSelectedReport(report)}
                  >
                    {report.period}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <div className="md:col-span-3">
          {renderReportDetail()}
        </div>
      </div>
    </div>
  )
}

export default function ReportsPage() {
    return (
        <Tabs defaultValue="monthly" className="w-full">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight font-headline">Reports</h2>
                     <p className="text-muted-foreground">
                        A summary of your financial activity.
                    </p>
                </div>
                <TabsList>
                    <TabsTrigger value="monthly">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly">Yearly</TabsTrigger>
                    <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="monthly" className="pt-6">
                <ReportView period="monthly" />
            </TabsContent>
            <TabsContent value="yearly" className="pt-6">
                <ReportView period="yearly" />
            </TabsContent>
            <TabsContent value="quarterly" className="pt-6">
                <QuarterlyReportView />
            </TabsContent>
        </Tabs>
    )
}
