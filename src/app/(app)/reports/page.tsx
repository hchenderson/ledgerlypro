
"use client";

import { useRef, useMemo, useState, lazy, Suspense, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DateRange } from 'react-day-picker';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { format } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Calendar as CalendarIcon, Loader2, BarChart } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useToast } from '@/hooks/use-toast';
import { useUserData } from '@/hooks/use-user-data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types';
import { getDashboardAnalytics } from '@/lib/actions';
import { useAuth } from '@/hooks/use-auth';

const OverviewChart = lazy(() => import('@/components/dashboard/overview-chart').then(module => ({ default: module.OverviewChart })));
const CategoryPieChart = lazy(() => import('@/components/reports/category-pie-chart').then(module => ({ default: module.CategoryPieChart })));

function ChartSuspenseFallback() {
    return (
        <div className="flex items-center justify-center h-[300px] w-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    )
}

function EmptyReportState() {
    return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-[300px] bg-muted/50 rounded-lg">
            <BarChart className="h-12 w-12 mb-4" />
            <p className="font-semibold">No data available for the selected filters.</p>
            <p className="text-sm">Try adjusting your date range or category selection.</p>
        </div>
    )
}


export default function ReportsPage() {
    const reportRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const { allTransactions } = useUserData();
    const { user } = useAuth();
    const [overallBalance, setOverallBalance] = useState(0);
    const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);

    const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    });
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    
    useEffect(() => {
      if (user) {
        setIsAnalyticsLoading(true);
        getDashboardAnalytics({ transactions: allTransactions, userId: user.uid })
          .then(analytics => {
            setOverallBalance(analytics.currentBalance);
            setIsAnalyticsLoading(false);
          });
      }
    }, [allTransactions, user]);
    
    useEffect(() => {
        if (dateRange?.from && dateRange?.to && dateRange.from > dateRange.to) {
            toast({
                variant: 'destructive',
                title: 'Invalid Date Range',
                description: 'The "from" date cannot be after the "to" date. Swapping dates for you.',
            });
            setDateRange({ from: dateRange.to, to: dateRange.from });
        }
    }, [dateRange, toast]);

    const filteredTransactions = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) {
            return [];
        }
        return allTransactions.filter(t => {
            const transactionDate = new Date(t.date);
            const isInDateRange = transactionDate >= dateRange.from! && transactionDate <= dateRange.to!;
            const isInCategory = categoryFilter === 'all' || t.category === categoryFilter;
            return isInDateRange && isInCategory;
        });
    }, [allTransactions, dateRange, categoryFilter]);

    const { overviewData, categoryData } = useMemo(() => {
        const data: { overview: any[], categories: any[] } = { overview: [], categories: [] };
        if (filteredTransactions.length === 0) return data;

        const monthlyData: Record<string, { income: number, expense: number }> = {};
        filteredTransactions.forEach(t => {
            const month = format(new Date(t.date), 'MMM');
            if (!monthlyData[month]) {
                monthlyData[month] = { income: 0, expense: 0 };
            }
            monthlyData[month][t.type] += t.amount;
        });

        data.overview = Object.entries(monthlyData).map(([name, values]) => ({
            name,
            ...values
        })).reverse();

        const categorySpending: Record<string, number> = {};
        filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
            if (!categorySpending[t.category]) {
                categorySpending[t.category] = 0;
            }
            categorySpending[t.category] += t.amount;
        });
        
        data.categories = Object.entries(categorySpending).map(([category, amount], index) => ({
            category,
            amount,
            fill: `hsl(var(--chart-${(index % 5) + 1}))`
        }));
        
        return data;
    }, [filteredTransactions]);
    
    const balanceTrendData = useMemo(() => {
        if (!dateRange?.from || isAnalyticsLoading) return [];
    
        const balanceBeforeRange = allTransactions
            .filter(t => new Date(t.date) < dateRange.from!)
            .reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), overallBalance - allTransactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0));
    
        if (filteredTransactions.length === 0) {
            return [{ name: format(dateRange.from, 'MMM'), balance: balanceBeforeRange }];
        }
    
        const monthlyChanges: Record<string, number> = {};
        filteredTransactions.forEach(t => {
            const month = format(new Date(t.date), 'MMM');
            if (!monthlyChanges[month]) {
                monthlyChanges[month] = 0;
            }
            monthlyChanges[month] += (t.type === 'income' ? t.amount : -t.amount);
        });
    
        let currentBalance = balanceBeforeRange;
        const trendData = overviewData.map(d => {
            currentBalance += (monthlyChanges[d.name] || 0);
            return {
                name: d.name,
                balance: currentBalance,
            };
        });
        
        return trendData.reverse();

    }, [filteredTransactions, allTransactions, dateRange, overallBalance, overviewData, isAnalyticsLoading]);

    const handleExportPdf = async () => {
        const input = reportRef.current;
        if (!input) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not find the report element to export.',
            });
            return;
        }

        toast({
            title: 'Exporting PDF...',
            description: 'Please wait while we generate your report.',
        });

        try {
            const canvas = await html2canvas(input, {
                scale: 2,
                useCORS: true,
                backgroundColor: null, 
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height],
            });

            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save('financial-report.pdf');
            
            toast({
                title: 'Export Successful',
                description: 'Your report has been downloaded.',
            });
        } catch (error) {
            console.error('Failed to export PDF:', error);
            toast({
                variant: 'destructive',
                title: 'Export Failed',
                description: 'An unexpected error occurred while generating the PDF.',
            });
        }
    };
    
    const allCategories = useMemo(() => [...new Set(allTransactions.map(t => t.category).filter(Boolean))], [allTransactions]);

    const handlePresetDateRange = (preset: string) => {
        const now = new Date();
        if (preset === 'this-month') {
            setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        } else if (preset === 'last-month') {
            const lastMonth = subMonths(now, 1);
            setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        }
    }


  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
            <h2 className="text-2xl font-bold tracking-tight font-headline">Financial Reports</h2>
            <p className="text-muted-foreground">
                Analyze your financial overview with detailed reports.
            </p>
        </div>
        <Button variant="outline" onClick={handleExportPdf} disabled={filteredTransactions.length === 0}>
            <Upload className="mr-2 h-4 w-4" />
            Export PDF
        </Button>
      </div>

       <Card>
           <CardHeader>
               <CardTitle>Filters</CardTitle>
           </CardHeader>
           <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-2 border-b">
                        <Button variant="link" size="sm" onClick={() => handlePresetDateRange('this-month')}>This Month</Button>
                        <Button variant="link" size="sm" onClick={() => handlePresetDateRange('last-month')}>Last Month</Button>
                    </div>
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
               <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                   <SelectTrigger className="w-full">
                       <SelectValue placeholder="Filter by category" />
                   </SelectTrigger>
                   <SelectContent>
                       <SelectItem value="all">All Categories</SelectItem>
                       {allCategories.map(cat => (
                           <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                       ))}
                   </SelectContent>
               </Select>
           </CardContent>
       </Card>

      <div ref={reportRef} className="space-y-6">
        {isAnalyticsLoading ? <ChartSuspenseFallback /> : (
            <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card>
                    <CardHeader>
                        <CardTitle>Income vs. Expense</CardTitle>
                        <CardDescription>A breakdown of your income and expenses for the selected period.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Suspense fallback={<ChartSuspenseFallback />}>
                            {overviewData.length > 0 ? <OverviewChart data={overviewData} /> : <EmptyReportState />}
                        </Suspense>
                    </CardContent>
                    </Card>
                    <Card>
                    <CardHeader>
                        <CardTitle>Category Breakdown</CardTitle>
                        <CardDescription>How your spending is distributed across different categories.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Suspense fallback={<ChartSuspenseFallback />}>
                            {categoryData.length > 0 ? <CategoryPieChart data={categoryData} /> : <EmptyReportState />}
                        </Suspense>
                    </CardContent>
                    </Card>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Balance Trend</CardTitle>
                        <CardDescription>Your account balance trend based on the filtered transactions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {balanceTrendData.length > 0 ? (
                            <ChartContainer
                                config={{
                                    balance: {
                                    label: "Balance",
                                    color: "hsl(var(--chart-1))",
                                    },
                                }}
                                className="h-[300px] w-full"
                                >
                                <AreaChart
                                    accessibilityLayer
                                    data={balanceTrendData}
                                    aria-label="Balance trend over time"
                                    role="img"
                                    margin={{
                                    left: 12,
                                    right: 12,
                                    }}
                                >
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        tickFormatter={(value) => value.slice(0, 3)}
                                    />
                                    <YAxis 
                                        dataKey="balance"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        tickFormatter={(value) => `$${value}`}
                                    />
                                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                                    <Area
                                        dataKey="balance"
                                        type="natural"
                                        fill="var(--color-balance)"
                                        fillOpacity={0.4}
                                        stroke="var(--color-balance)"
                                    />
                                </AreaChart>
                            </ChartContainer>
                        ) : <EmptyReportState />}
                    </CardContent>
                </Card>
            </>
        )}
        </div>
    </div>
  );
}
