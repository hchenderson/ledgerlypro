"use client";

import Link from "next/link";
import { AlertTriangle, Building2, CheckCircle2, Clock3, ListChecks } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlaid } from "@/hooks/use-plaid";
import { isTransactionReviewable } from "@/lib/categorization";
import type { Transaction } from "@/types";

export function PlaidHealthStrip({ transactions }: { transactions: Transaction[] }) {
  const { items, loading } = usePlaid();
  const active = items.filter((item) => item.status !== "disconnected");
  if (loading || active.length === 0) return null;
  const attention = active.filter((item) => ["needs-attention", "permission-expiring", "delayed"].includes(item.status));
  const pending = transactions.filter((transaction) => transaction.postingStatus === "pending").length;
  const review = transactions.filter(isTransactionReviewable).length;
  const latest = active.map((item) => item.lastSuccessfulSync).filter((value): value is string => Boolean(value)).sort().at(-1);

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4" /> Bank data</span>
        <Badge variant={attention.length > 0 ? "destructive" : "secondary"}>
          {attention.length > 0 ? <AlertTriangle className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
          {attention.length > 0 ? `${attention.length} connection${attention.length === 1 ? "" : "s"} need attention` : `${active.length} connected`}
        </Badge>
        <span className="flex items-center gap-1.5 text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> {latest ? `Synced ${new Date(latest).toLocaleString()}` : "Initial sync pending"}</span>
        {pending > 0 ? <span className="text-muted-foreground">{pending} pending</span> : null}
      </div>
      <div className="flex gap-2">
        {review > 0 ? <Button size="sm" variant="outline" asChild><Link href="/transactions/review"><ListChecks className="mr-2 h-4 w-4" /> Review {review}</Link></Button> : null}
        <Button size="sm" variant="ghost" asChild><Link href="/accounts">Manage</Link></Button>
      </div>
    </div>
  );
}
