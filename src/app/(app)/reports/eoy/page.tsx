// /app/reports/eoy/page.tsx
"use client";

import { useUserData } from "@/hooks/use-user-data";
import { EOYReport } from "@/components/reports/EOYReport";

export default function EOYReportPage() {
  const { allTransactions, categories, goals, loading } = useUserData();

  if (loading) {
    return <div className="p-6">Loading your data…</div>;
  }

  if (!allTransactions.length) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">End-of-Year Report</h1>
        <p className="text-muted-foreground">
          There are no transactions yet for an end-of-year summary. Start
          recording income and expenses to unlock this report.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <EOYReport
        allTransactions={allTransactions}
        categories={categories}
        goals={goals}
      />
    </div>
  );
}
