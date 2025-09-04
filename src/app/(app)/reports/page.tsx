
"use client";

import { useRef, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DateRange } from 'react-day-picker';
import { addDays, format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { CategoryPieChart } from "@/components/reports/category-pie-chart";
import { Button } from "@/components/ui/button";
import { Upload, Calendar as CalendarIcon } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useToast } from '@/hooks/use-toast';
import { useUserData } from '@/hooks/use-user-data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { FeatureGate } from '@/components/feature-gate';


function ReportsPageContent() {
    const reportRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const { transactions } = useUserData();
    
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    });
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const isInDateRange = dateRange?.from && dateRange?.to ? 
                (transactionDate >= dateRange.from && transactionDate <= dateRange.to) : true;
            const isInCategory = categoryFilter === 'all' || t.category === categoryFilter;
            return isInDateRange && isInCategory;
        });
    }, [transactions, dateRange, categoryFilter]);

    const { overviewData, categoryData } = useMemo(() => {
        const monthlyData: Record<string, { income: number, expense: number }> = {};
        filteredTransactions.forEach(t => {
            const month = new Date(t.date).toLocaleString('default', { month: 'short' });
            if (!monthlyData[month]) {
                monthlyData[month] = { income: 0, expense: 0 };
            }
            monthlyData[month][t.type] += t.amount;
        });

        const overviewData = Object.entries(monthlyData).map(([name, values]) => ({
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
        
        const categoryData = Object.entries(categorySpending).map(([category, amount], index) => ({
            category,
            amount,
            fill: `hsl(var(--chart-${(index % 5) + 1}))`
        }));
        
        return { overviewData, categoryData };
    }, [filteredTransactions]);
    
    const balanceTrendData = useMemo(() => {
        let currentBalance = 0;
        const trend = overviewData.map(d => {
            currentBalance += d.income - d.expense;
            return {
                name: d.name,
                balance: currentBalance,
            }
        });
        return trend.reverse();
    }, [overviewData]);

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
    
    const allCategories = useMemo(() => [...new Set(transactions.map(t => t.category))], [transactions]);

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
       <div className="flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold tracking-tight font-headline">Financial Reports</h2>
            <p className="text-muted-foreground">
                Your monthly financial overview.
            </p>
        </div>
        <Button variant="outline" onClick={handleExportPdf}>
          <Upload className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>

       <Card>
           <CardHeader>
               <CardTitle>Filters</CardTitle>
           </CardHeader>
           <CardContent className="flex flex-col md:flex-row gap-4">
               <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-[300px] justify-start text-left font-normal",
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
                    <div className="p-2">
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
                    />
                  </PopoverContent>
                </Popover>
               <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                   <SelectTrigger className="w-full md:w-[200px]">
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
            <CardHeader>
                <CardTitle>Income vs. Expense</CardTitle>
                <CardDescription>A breakdown of your income and expenses over the last few months.</CardDescription>
            </CardHeader>
            <CardContent>
                <OverviewChart data={overviewData} />
            </CardContent>
            </Card>
            <Card>
            <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
                <CardDescription>How your spending is distributed across different categories this month.</CardDescription>
            </CardHeader>
            <CardContent>
                <CategoryPieChart data={categoryData} />
            </CardContent>
            </Card>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Balance Trend</CardTitle>
                <CardDescription>Your account balance over time.</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
            </Card>
        </div>
    </div>
  );
}

export default function ReportsPage() {
    return (
        <FeatureGate>
            <ReportsPageContent />
        </FeatureGate>
    )
}
