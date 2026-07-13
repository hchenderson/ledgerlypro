
// /app/reports/eoy/page.tsx
"use client";

import { useUserData } from "@/hooks/use-user-data";
import { EOYReport } from "@/components/reports/EOYReport";
import { useAuth } from "@/hooks/use-auth";

export default function EOYReportPage() {
  const { allTransactions, categories, goals, loading, startingBalance } = useUserData();
  const { activeYear } = useAuth();

  if (loading) {
    return <div className="p-6">Loading your data…</div>;
  }

  return (
    <div className="p-6">
      <EOYReport
        allTransactions={allTransactions}
        categories={categories}
        goals={goals}
        startingBalance={startingBalance}
        initialYear={activeYear}
      />
    </div>
  );
}
