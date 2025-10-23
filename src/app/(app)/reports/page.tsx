

'use client';

import React, { useState, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import type { Category, SubCategory } from '@/types';
import { DateRange } from 'react-day-picker';
import { subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, getYear } from 'date-fns';

import { OverviewChart } from '@/components/dashboard/overview-chart';
import { CategoryPieChart } from '@/components/reports/category-pie-chart';
import { GlobalFilters } from '@/components/reports/global-filters';
import { cn } from '@/lib/utils';

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
          
          if (isMain && !mainCat?.subCategories?.length) { // Main cat with no subs
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

          if (isMain && !mainCat?.subCategories?.length) {
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

  return (
    <div className="space-y-6">
       <GlobalFilters
            presetRanges={PRESET_RANGES}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            onPresetChange={handlePresetChange}
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp/> Income vs. Expense Overview</CardTitle>
             <CardDescription>
              A summary of your cash flow for the selected period.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChartIcon/> Income Breakdown</CardTitle>
             <CardDescription>
              Where your income comes from. Select a single category to see sub-category details.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <GlobalFilters
                presetRanges={[]}
                dateRange={undefined}
                onDateRangeChange={() => {}}
                onPresetChange={() => {}}
                categoryOptions={getCategoryOptions('income')}
                selectedCategories={selectedIncomeCategories}
                onSelectedCategoriesChange={setSelectedIncomeCategories}
                showCategoryFilter={true}
                filterTitle="Filter Income Categories"
              />
            <CategoryPieChart data={incomeByCategory} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChartIcon/> Expense Breakdown</CardTitle>
            <CardDescription>
              Where your money is going. Select a single category to see sub-category details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GlobalFilters
                presetRanges={[]}
                dateRange={undefined}
                onDateRangeChange={() => {}}
                onPresetChange={() => {}}
                categoryOptions={getCategoryOptions('expense')}
                selectedCategories={selectedExpenseCategories}
                onSelectedCategoriesChange={setSelectedExpenseCategories}
                showCategoryFilter={true}
                filterTitle="Filter Expense Categories"
              />
            <CategoryPieChart data={expenseByCategory} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
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
                </TabsList>
            </div>
            <TabsContent value="monthly" className="pt-6">
                <ReportView period="monthly" />
            </TabsContent>
            <TabsContent value="yearly" className="pt-6">
                <ReportView period="yearly" />
            </TabsContent>
        </Tabs>
    )
}

    