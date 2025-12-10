
"use client";

import React, { useMemo, useRef, useState } from "react";
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
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type { PieLabelRenderProps } from "recharts";

interface EOYReportProps {
  allTransactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  initialYear?: number;
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

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background p-3 border rounded-lg shadow-lg">
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
      <div className="bg-background p-3 border rounded-lg shadow-lg">
        <p className="font-bold">{data.name}</p>
        <p>{formatCurrency(data.value)}</p>
      </div>
    );
  }
  return null;
};

const renderCategoryLabel = (props: PieLabelRenderProps) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius! + (outerRadius! - innerRadius!) * 0.6;
  const x = cx! + radius * Math.cos(-midAngle * RADIAN);
  const y = cy! + radius * Math.sin(-midAngle * RADIAN);

  if (typeof percent !== 'number' || percent < 0.05) return null; // Don't render label for small slices

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor={x > cx! ? "start" : "end"}
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
}) => {
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const data = useMemo(
    () => computeEOYReport(allTransactions, categories, year),
    [allTransactions, categories, year]
  );

  const monthlyChartData = useMemo(() => {
    let runningBalance = 0;
  
    return data.monthly.map((m) => {
      const income = Number(m.income);
      const expenses = Number(m.expenses);
      const net = income - expenses; // or Number(m.net), they should match
  
      runningBalance += net;
  
      return {
        month: m.label,
        income,
        expenses,
        net,
        runningBalance,
      };
    });
  }, [data]);

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
      setIsGenerating(true);
      setAiSummary(null);

      const res = await fetch("/api/eoy-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Year:</span>
          <select
            className="border rounded-md px-2 py-1 bg-background"
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

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            Export as PDF
          </Button>
          <Button onClick={handleGenerateSummary} disabled={isGenerating}>
            {isGenerating ? "Generating summary…" : "Generate AI Summary"}
          </Button>
        </div>
      </div>

      {/* Report body */}
      <div ref={reportRef} className="space-y-6 bg-background p-4 rounded-lg">
        <h1 className="text-3xl font-bold mb-2">
          End-of-Year Report – {data.year}
        </h1>
        <p className="text-muted-foreground mb-4">
          A holistic view of your spending, income, and financial priorities
          across the past year.
        </p>

        {/* Executive summary */}
        <Card>
          <CardHeader>
            <CardTitle>Executive Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-2xl font-semibold">
                {formatCurrency(data.totalIncome)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-semibold">
                {formatCurrency(data.totalExpenses)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Position</p>
              <p
                className={`text-2xl font-semibold ${
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
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis
                  type="number"
                  tickFormatter={(value: number) => formatCurrency(Number(value))}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="#2ecc71"
                  name="Income"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#e74c3c"
                  name="Expenses"
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="#3498db"
                  name="Net"
                />
                <Line
                  type="monotone"
                  dataKey="runningBalance"
                  stroke="#8e44ad"
                  name="Running Balance"
                />
      
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Spending by Category</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {categoryPieData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={100}
                      label={renderCategoryLabel}
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
              ) : (
                <p className="text-muted-foreground">
                  No expense data available for this year.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Category Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-80 overflow-y-auto">
              {data.categories.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.percentageOfTotal.toFixed(1)}% of expenses
                    </span>
                  </div>
                  <span>{formatCurrency(c.total)}</span>
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
          <CardContent className="flex flex-wrap gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Goals</p>
              <p className="text-xl font-semibold">{totalGoals}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed Goals</p>
              <p className="text-xl font-semibold">{completedGoals}</p>
            </div>
            <div>
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
          <CardContent>
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
