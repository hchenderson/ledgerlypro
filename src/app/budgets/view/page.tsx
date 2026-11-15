"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { AlertCircle, CheckCircle2, Clock3, LogOut, RefreshCw, Target, WifiOff } from "lucide-react";
import Link from "next/link";

import { LedgerlyBrand } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  authenticatedBudgetPortalFetch,
  budgetPortalAuth,
  prepareBudgetPortalAuth,
} from "@/lib/budget-portal-client";
import type { BudgetPortalSummaryResponse } from "@/lib/budget-portal-types";

function currency(minor: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);
}

function dateTime(value: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function BudgetPortalPage() {
  const [summary, setSummary] = useState<BudgetPortalSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  const refresh = useCallback(async (manual = false) => {
    if (requestInFlight.current || !budgetPortalAuth.currentUser) return;
    requestInFlight.current = true;
    if (manual) setRefreshing(true);
    setError(null);
    try {
      const response = await authenticatedBudgetPortalFetch("/api/budget-portal/summary", { cache: "no-store" });
      const data = await response.json() as BudgetPortalSummaryResponse & { error?: string };
      if (!response.ok) {
        if (response.status === 401) {
          setSummary(null);
          await signOut(budgetPortalAuth);
        }
        throw new Error(data.error || "Budget information could not be loaded.");
      }
      setSummary(data);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Budget information could not be loaded.");
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    void prepareBudgetPortalAuth().then(() => {
      unsubscribe = onAuthStateChanged(budgetPortalAuth, (user) => {
        setSessionReady(true);
        if (user) void refresh();
        else setLoading(false);
      });
    });
    return () => unsubscribe();
  }, [refresh]);

  useEffect(() => {
    if (!summary) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh, summary]);

  const logout = async () => {
    setSummary(null);
    await signOut(budgetPortalAuth);
  };

  if (!sessionReady || loading) {
    return <main className="flex min-h-dvh items-center justify-center bg-brand-mint p-6"><p className="text-muted-foreground">Loading your budget access…</p></main>;
  }

  if (!budgetPortalAuth.currentUser || !summary) {
    return (
      <main className="brand-grid flex min-h-dvh items-center justify-center bg-brand-mint p-4">
        <Card className="w-full max-w-md">
          <CardHeader><LedgerlyBrand className="mb-4" /><CardTitle>Budget access needed</CardTitle><CardDescription>{error || "Request a new one-time code from the Ledgerly sign-in page."}</CardDescription></CardHeader>
          <CardContent><Button asChild className="w-full"><Link href="/signin?budget=1">Return to sign in</Link></Button></CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-brand-mint/60 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <LedgerlyBrand />
          <div className="flex items-center gap-2">
            <Button aria-label="Refresh" variant="outline" size="sm" className="h-10 gap-2" onClick={() => void refresh(true)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-10 gap-2" onClick={() => void logout()}><LogOut className="h-4 w-4" /> Sign out</Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <p className="text-sm font-medium text-primary">Read-only Budget Portal</p>
          <h1 className="mt-1 font-headline text-2xl font-bold sm:text-3xl">{summary.viewer.displayName ? `${summary.viewer.displayName}'s budgets` : "Your assigned budgets"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Recorded spending reflects finalized ledger activity. You cannot view transactions or change financial data here.</p>
        </div>

        {error ? <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Refresh failed</AlertTitle><AlertDescription>{error} The last loaded figures remain visible.</AlertDescription></Alert> : null}
        {summary.notice ? <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Overlapping budget cards</AlertTitle><AlertDescription>{summary.notice}</AlertDescription></Alert> : null}
        {summary.unavailableAssignments > 0 ? <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Assignment changed</AlertTitle><AlertDescription>{summary.unavailableAssignments} assigned budget is no longer available. Ask the owner to update your access.</AlertDescription></Alert> : null}

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">Data freshness</CardTitle><CardDescription>A recent calculation is not the same as a complete bank sync or owner review.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border p-3"><div className="flex items-center gap-2 font-medium"><Clock3 className="h-4 w-4" /> Summary updated</div><p className="mt-1 text-muted-foreground">{dateTime(summary.freshness.summaryUpdatedAt)}</p></div>
            <div className="rounded-xl border p-3"><div className="flex items-center gap-2 font-medium">{summary.freshness.bankCoverage === "failed" ? <WifiOff className="h-4 w-4 text-destructive" /> : <RefreshCw className="h-4 w-4" />} Bank activity synced</div><p className="mt-1 text-muted-foreground">{dateTime(summary.freshness.bankActivitySyncedAt)} · {summary.freshness.bankCoverage}</p></div>
            <div className="rounded-xl border p-3"><div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> Reviewed through</div><p className="mt-1 text-muted-foreground">{summary.freshness.reviewedThrough || "Not set"} · Entire ledger</p></div>
          </CardContent>
        </Card>

        {summary.budgets.length === 0 ? (
          <Card className="py-8 text-center"><CardHeader><Target className="mx-auto h-10 w-10 text-muted-foreground" /><CardTitle>No budgets are assigned</CardTitle><CardDescription>The owner may have revoked access, deleted a budget, or not completed an assignment.</CardDescription></CardHeader></Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {summary.budgets.map((budget) => (
              <Card key={budget.id} className={budget.overBudget ? "border-destructive/60" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3"><div><CardTitle className="break-words text-xl">{budget.name}</CardTitle><CardDescription>{budget.periodLabel} · {budget.period === "monthly" ? "Monthly" : "Yearly"} budget</CardDescription></div>{budget.overBudget ? <Badge variant="destructive">Over budget</Badge> : null}</div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-3 gap-2">
                    <div><p className="text-xs text-muted-foreground">Budgeted</p><p className="mt-1 font-semibold">{currency(budget.budgetedMinor)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Recorded</p><p className="mt-1 font-semibold">{currency(budget.spendingMinor)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Remaining</p><p className={`mt-1 font-semibold ${budget.overBudget ? "text-destructive" : ""}`}>{currency(budget.remainingMinor)}</p></div>
                  </div>
                  <div><div className="mb-2 flex justify-between text-sm"><span>Used</span><span>{budget.percentageUsed === null ? "No budget amount" : `${budget.percentageUsed.toFixed(1)}%`}</span></div><Progress value={Math.max(0, Math.min(100, budget.percentageUsed ?? 0))} className={budget.overBudget ? "[&>div]:bg-destructive" : ""} /></div>
                  {budget.categoryBreakdown.length > 1 ? <div className="space-y-2 border-t pt-4"><p className="text-sm font-medium">Authorized category breakdown</p>{budget.categoryBreakdown.slice(0, 8).map((line) => <div key={`${line.categoryId}:${line.name}`} className="flex justify-between gap-4 text-sm"><span className="truncate text-muted-foreground">{line.name}</span><span>{currency(line.spendingMinor)}</span></div>)}</div> : null}
                  {budget.overlapsOtherAssignedBudget ? <p className="text-xs text-muted-foreground">This card overlaps another assigned parent or child budget. Do not add the cards together.</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
