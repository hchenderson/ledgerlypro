"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  WalletCards,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccounts } from "@/hooks/use-accounts";
import { useAuth } from "@/hooks/use-auth";
import { useEnvelopes } from "@/hooks/use-envelopes";
import { useAllTransactions } from "@/hooks/use-transactions";
import { calculateUnassignedCash } from "@/lib/envelopes";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function EnvelopeSnapshot() {
  const { budgetingMode, envelopeSettings } = useAuth();
  const { accounts } = useAccounts();
  const { activeEnvelopes, getSummaries, loading } = useEnvelopes();
  const { transactions, loading: transactionsLoading } =
    useAllTransactions({
      enabled: budgetingMode !== "tracking",
      respectAccountFilter: false,
    });

  if (budgetingMode === "tracking") return null;
  const summaries = getSummaries();
  const available = summaries.reduce(
    (total, summary) => total + summary.available,
    0,
  );
  const pendingCommitted = summaries.reduce(
    (total, summary) => total + summary.pendingCommitted,
    0,
  );
  const spendable = summaries.reduce(
    (total, summary) => total + summary.spendableAvailable,
    0,
  );
  const bills = summaries
    .filter((summary) => summary.envelope.type === "bills")
    .reduce((total, summary) => total + summary.available, 0);
  const flexible = summaries
    .filter(
      (summary) => summary.envelope.type === "monthly-spending",
    )
    .reduce((total, summary) => total + summary.available, 0);
  const savings = summaries
    .filter((summary) =>
      ["savings", "sinking-fund"].includes(summary.envelope.type),
    )
    .reduce((total, summary) => total + summary.available, 0);
  const attention = summaries.filter(
    (summary) => summary.status !== "healthy",
  );
  const unassigned = calculateUnassignedCash({
    accounts,
    transactions,
    summaries,
    minimumOperatingBalance: envelopeSettings.minimumOperatingBalance,
  });

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="flex flex-col gap-3 bg-secondary/25 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <WalletCards className="h-5 w-5" /> Envelope snapshot
          </CardTitle>
          <CardDescription>
            Purpose-based balances; existing income and expense totals are unchanged.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/budgets">
            Open plan <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-5">
        {loading || transactionsLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Loading envelope balances…
          </p>
        ) : activeEnvelopes.length === 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Envelope mode is on. Set up the first account-backed envelope to begin assigning money.
            </p>
            <Button size="sm" asChild><Link href="/budgets">Set up envelopes</Link></Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Ready to assign</p><p className={`mt-1 text-lg font-semibold ${unassigned < 0 ? "text-destructive" : ""}`}>{currency.format(unassigned)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Available</p><p className="mt-1 text-lg font-semibold">{currency.format(available)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Pending card activity</p><p className="mt-1 text-lg font-semibold">{currency.format(pendingCommitted)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Spendable after pending</p><p className="mt-1 text-lg font-semibold">{currency.format(spendable)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Bills funded</p><p className="mt-1 text-lg font-semibold">{currency.format(bills)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Flexible spending</p><p className="mt-1 text-lg font-semibold">{currency.format(flexible)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Savings</p><p className="mt-1 text-lg font-semibold">{currency.format(savings)}</p></div>
            </div>
            <div className="mt-4 flex items-start gap-2 text-sm">
              {attention.length > 0 ? (
                <>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p>{attention.length} envelope{attention.length === 1 ? " needs" : "s need"} funding or overspending review. Ledgerly will not move money automatically.</p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <p>All configured envelope targets are currently on track.</p>
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
