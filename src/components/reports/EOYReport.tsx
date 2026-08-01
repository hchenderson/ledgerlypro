
"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import type { Transaction, Category, Goal } from "@/types";
import { computeEOYReport } from "@/lib/eoy";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from "@/hooks/use-mobile";
import { startOfYear } from "date-fns";
import { transactionBalanceDelta } from "@/lib/accounts";
import { useAccounts } from "@/hooks/use-accounts";

interface EOYReportProps {
  allTransactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  initialYear?: number;
  startingBalance?: number;
}

const pieColors = [
  "#285943",
  "#4A7C59",
  "#7ABF8E",
  "#C6F1D6",
  "#34495E",
  "#9B59B6",
  "#E67E22",
  "#E74C3C",
];

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

const formatCompactCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="max-w-[calc(100vw-2rem)] rounded-lg border bg-background p-3 text-xs shadow-lg sm:text-sm">
                <p className="font-bold">{label}</p>
                {payload.map((p: any) => (
                    <p key={p.name} style={{ color: p.color }}>{`${p.name}: ${formatCurrency(p.value)}`}</p>
                ))}
            </div>
        );
    }
    return null;
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="max-w-[calc(100vw-2rem)] rounded-lg border bg-background p-3 text-xs shadow-lg sm:text-sm">
        <p className="font-bold">{data.name}</p>
        <p>{formatCurrency(data.value)}</p>
      </div>
    );
  }
  return null;
};

const renderCategoryLabel = (props: PieLabelRenderProps) => {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const percent = Number(props.percent ?? 0);
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (typeof percent !== 'number' || percent < 0.05) return null; // Don't render label for small slices

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      style={{ fontSize: 10, fontWeight: 'bold' }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};


export const EOYReport: React.FC<EOYReportProps> = ({
  allTransactions,
  categories,
  goals,
  initialYear,
  startingBalance = 0,
}) => {
  const { user } = useAuth();
  const {
    accounts,
    allAccountsSelected,
    selectedAccountIds,
  } = useAccounts();
  const isMobile = useIsMobile();
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const categoryDetailsRef = useRef<HTMLDivElement | null>(null);
  const accountScopeLabel = allAccountsSelected
    ? "All accounts"
    : selectedAccountIds
        .map(
          (accountId) =>
            accounts.find((account) => account.id === accountId)?.name,
        )
        .filter(Boolean)
        .join(", ") || "Selected accounts";
  
  useEffect(() => {
    if (initialYear) {
      setYear(initialYear);
    }
  }, [initialYear]);

  const data = useMemo(
    () => computeEOYReport(allTransactions, categories, year),
    [allTransactions, categories, year]
  );

  const openingBalanceForReportYear = useMemo(() => {
    const reportStart = startOfYear(new Date(year, 0, 1)).getTime();
    return allTransactions.reduce((balance, transaction) => {
      const transactionTime = new Date(transaction.date).getTime();
      if (
        Number.isNaN(transactionTime) ||
        transactionTime >= reportStart
      ) {
        return balance;
      }
      return balance + transactionBalanceDelta(transaction);
    }, startingBalance);
  }, [allTransactions, startingBalance, year]);

  const monthlyChartData = useMemo(() => {
    let runningBalance = openingBalanceForReportYear;
  
    return data.monthly.map((m) => {
      const income = Number(m.income);
      const expenses = Number(m.expenses);
      const net = income - expenses;
  
      runningBalance += m.balanceChange;
  
      return {
        month: m.label,
        income,
        expenses,
        net,
        runningBalance,
      };
    });
  }, [data, openingBalanceForReportYear]);

  const categoryPieData = useMemo(
    () =>
      data.mainCategories.map((c) => ({
        name: c.name,
        value: c.total,
      })),
    [data]
  );

  const totalGoals = goals.length;
  const completedGoals = goals.filter(
    (g) => g.savedAmount >= g.targetAmount
  ).length;

  const handleGenerateSummary = async () => {
    try {
      if (!user) throw new Error('You must be signed in.');
      setIsGenerating(true);
      setAiSummary(null);
      const idToken = await user.getIdToken();

      const res = await fetch("/api/eoy-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          year: data.year,
          totalIncome: data.totalIncome,
          totalExpenses: data.totalExpenses,
          net: data.net,
          topCategories: data.categories,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate summary");
      const json = await res.json();
      setAiSummary(json.summary);
    } catch (err) {
      console.error(err);
      setAiSummary(
        "Unable to generate a narrative at the moment. Please try again shortly."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    const element = reportRef.current;
    setIsExporting(true);

    // Temporarily turn off scrolling for Category Details so all rows render
    const categoryEl = categoryDetailsRef.current;
    let previousMaxHeight: string | null = null;
    let previousOverflowY: string | null = null;

    if (categoryEl) {
      previousMaxHeight = categoryEl.style.maxHeight;
      previousOverflowY = categoryEl.style.overflowY;

      categoryEl.style.maxHeight = "none";
      categoryEl.style.overflowY = "visible";
    }

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgProps = {
        width: pageWidth,
        height: (canvas.height * pageWidth) / canvas.width,
      };

      let position = 0;
      let heightLeft = imgProps.height;

      pdf.addImage(imgData, "PNG", 0, position, imgProps.width, imgProps.height);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgProps.height;
        pdf.addPage();
        pdf.addImage(
          imgData,
          "PNG",
          0,
          position,
          imgProps.width,
          imgProps.height
        );
        heightLeft -= pageHeight;
      }

      pdf.save(`ledgerly-eoy-${data.year}.pdf`);
    } finally {
      // Restore original scrolling behaviour
      if (categoryEl) {
        categoryEl.style.maxHeight = previousMaxHeight ?? "";
        categoryEl.style.overflowY = previousOverflowY ?? "";
      }
      setIsExporting(false);
    }
  };

  const possibleYears = useMemo(() => {
    if (!allTransactions.length) return [year];
    const years = allTransactions.map((t) =>
      new Date(t.date).getFullYear()
    );
    const unique = Array.from(new Set(years));
    unique.sort((a, b) => a - b);
    return unique;
  }, [allTransactions, year]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-end sm:justify-between sm:p-4">
        <div className="w-full space-y-1.5 sm:w-auto">
          <label htmlFor="eoy-report-year" className="block text-sm font-semibold">
            Report year
          </label>
          <select
            id="eoy-report-year"
            className="h-11 w-full rounded-md border bg-background px-3 text-base sm:w-32"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {possibleYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 min-[430px]:grid-cols-2 sm:flex sm:w-auto">
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={isExporting}
            aria-busy={isExporting}
            className="w-full sm:w-auto"
          >
            {isExporting ? "Preparing PDF…" : "Export as PDF"}
          </Button>
          <Button
            onClick={handleGenerateSummary}
            disabled={isGenerating}
            aria-busy={isGenerating}
            className="w-full sm:w-auto"
          >
            {isGenerating ? "Generating summary…" : "Generate AI Summary"}
          </Button>
        </div>
      </div>

      {/* Report body */}
      <div ref={reportRef} className="space-y-4 rounded-lg bg-background sm:space-y-6 sm:p-4">
        <h1 className="mb-2 break-words text-2xl font-bold sm:text-3xl">
          End-of-Year Report – {data.year}
        </h1>
        <p className="text-muted-foreground mb-4">
          A holistic view of your spending, income, and financial priorities
          across the past year.
        </p>
        <p className="-mt-2 mb-4 text-sm font-medium">
          Account scope: {accountScopeLabel}
        </p>

        {/* Executive summary */}
        <Card>
          <CardHeader>
            <CardTitle>Executive Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-lg bg-muted/30 p-3 sm:bg-transparent sm:p-0">
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="break-words text-xl font-semibold sm:text-2xl">
                {formatCurrency(data.totalIncome)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 sm:bg-transparent sm:p-0">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="break-words text-xl font-semibold sm:text-2xl">
                {formatCurrency(data.totalExpenses)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 sm:bg-transparent sm:p-0">
              <p className="text-sm text-muted-foreground">Net Position</p>
              <p
                className={`break-words text-xl font-semibold sm:text-2xl ${
                  data.net >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {formatCurrency(data.net)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Monthly cashflow */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Cashflow</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
            <div
              className="h-72 w-full sm:h-80"
              role="img"
              aria-label={`Monthly income, expenses, net cash flow, and running balance for ${data.year}`}
            >
              <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyChartData}
                margin={{
                  top: 8,
                  right: isMobile ? 4 : 12,
                  left: isMobile ? -16 : 8,
                  bottom: 4,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  fontSize={isMobile ? 10 : 12}
                  tickLine={false}
                  interval={isMobile ? 1 : 0}
                />
                <YAxis
                  type="number"
                  width={isMobile ? 56 : 84}
                  fontSize={isMobile ? 10 : 12}
                  tickLine={false}
                  tickFormatter={(value: number) => formatCompactCurrency(Number(value))}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{
                    fontSize: isMobile ? 10 : 12,
                    lineHeight: isMobile ? "20px" : "24px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="#2ecc71"
                  name="Income"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: isMobile ? 7 : 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#e74c3c"
                  name="Expenses"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: isMobile ? 7 : 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="#3498db"
                  name="Net"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: isMobile ? 7 : 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="runningBalance"
                  stroke="#8e44ad"
                  name="Running Balance"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: isMobile ? 7 : 5 }}
                />
      
              </LineChart>
            </ResponsiveContainer>
            </div>
            <details className="mt-3 rounded-lg border bg-muted/20 text-sm">
              <summary className="cursor-pointer px-3 py-2 font-medium">
                View monthly data
              </summary>
              <div className="max-h-72 overflow-auto border-t">
                <table className="w-full min-w-[38rem] text-left text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr>
                      <th className="px-3 py-2 font-medium">Month</th>
                      <th className="px-3 py-2 text-right font-medium">Income</th>
                      <th className="px-3 py-2 text-right font-medium">Expenses</th>
                      <th className="px-3 py-2 text-right font-medium">Net</th>
                      <th className="px-3 py-2 text-right font-medium">Running balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyChartData.map((month) => (
                      <tr key={month.month} className="border-t">
                        <td className="px-3 py-2">{month.month}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(month.income)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(month.expenses)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(month.net)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(month.runningBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Spending by Category</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
              {categoryPieData.length ? (
                <>
                <div
                  className="h-64 sm:h-80"
                  role="img"
                  aria-label={`Expense category distribution for ${data.year}`}
                >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={isMobile ? 82 : 100}
                      label={isMobile ? false : renderCategoryLabel}
                      labelLine={false}
                    >
                      {categoryPieData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={pieColors[index % pieColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3 sm:hidden">
                  {categoryPieData.map((category, index) => (
                    <div key={category.name} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: pieColors[index % pieColors.length] }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{category.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatCurrency(category.value)}
                      </span>
                    </div>
                  ))}
                </div>
                </>
              ) : (
                <p className="flex min-h-48 items-center justify-center px-4 text-center text-muted-foreground">
                  No expense data available for this year.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Category Details</CardTitle>
            </CardHeader>
            <CardContent
              ref={categoryDetailsRef}
              className="max-h-80 space-y-2 overflow-y-auto"
            >
              {data.categories.map((c) => (
                <div
                  key={c.name}
                  className="flex items-start justify-between gap-3 rounded-lg border-b py-2 text-sm last:border-b-0"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="break-words font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.percentageOfTotal.toFixed(1)}% of expenses
                    </span>
                  </div>
                  <span className="shrink-0 text-right font-medium tabular-nums">{formatCurrency(c.total)}</span>
                </div>
              ))}
              {!data.categories.length && (
                <p className="text-muted-foreground">
                  No categories with recorded expenses this year.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Goals snapshot */}
        <Card>
          <CardHeader>
            <CardTitle>Goals Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-3 sm:gap-6">
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">Total Goals</p>
              <p className="text-xl font-semibold">{totalGoals}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">Completed Goals</p>
              <p className="text-xl font-semibold">{completedGoals}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">
                Completion Rate
              </p>
              <p className="text-xl font-semibold">
                {totalGoals
                  ? `${((completedGoals / totalGoals) * 100).toFixed(1)}%`
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* AI narrative */}
        <Card>
          <CardHeader>
            <CardTitle>Year-End Narrative</CardTitle>
          </CardHeader>
          <CardContent aria-live="polite">
            {aiSummary ? (
              <p className="whitespace-pre-line leading-relaxed">
                {aiSummary}
              </p>
            ) : (
              <p className="text-muted-foreground italic">
                Use “Generate AI Summary” above to create a written reflection
                on how this year unfolded financially.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
