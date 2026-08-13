
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTransactionData } from "@/hooks/use-transactions";
import { useAuth } from "@/hooks/use-auth";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { Rocket, Sparkles, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FeatureGate } from "@/components/feature-gate";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { expandTransactionsForReporting } from "@/lib/transaction-allocations";

function ProjectionsPageContent() {
  const [loading, setLoading] = useState(false);
  const [projection, setProjection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const {
    transactions: allTransactions,
    loading: userDataLoading,
  } = useTransactionData();
  const { user } = useAuth();
  const financialTransactions = useMemo(
    () =>
      expandTransactionsForReporting(allTransactions)
        .filter(
          (transaction) =>
            transaction.type === "income" ||
            transaction.type === "expense",
        )
        .map((transaction) => ({
          ...transaction,
          amount: Math.abs(transaction.amount),
        })),
    [allTransactions],
  );
  const hasTransactions = financialTransactions.length > 0;

  useEffect(() => {
    if (!loading && (projection || error)) {
      resultRef.current?.focus({ preventScroll: true });
      resultRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    }
  }, [loading, projection, error]);

  const handleGenerateProjection = async () => {
    setLoading(true);
    setError(null);
    setProjection(null);

    if (financialTransactions.length === 0) {
        setError("You need at least one transaction to generate a projection.");
        setLoading(false);
        return;
    }

    try {
      if (!user) throw new Error("You must be signed in.");
      const input = {
        historicalData: JSON.stringify(financialTransactions),
        userPrompt: userPrompt || undefined,
      };
      const response = await authenticatedFetch(user, '/api/ai/projections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      const result = (await response.json()) as { projection?: string; error?: string };
      if (!response.ok || !result.projection) {
        throw new Error(result.error ?? 'Projection request failed');
      }
      setProjection(result.projection);
    } catch (e) {
      setError("Failed to generate projection. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-5 pb-6 sm:space-y-6">
      <div className="text-center">
        <Rocket className="mx-auto h-10 w-10 text-primary sm:h-12 sm:w-12" />
        <h1 className="mt-3 font-headline text-2xl font-bold tracking-tight min-[375px]:text-3xl sm:mt-4 sm:text-4xl">
          AI Financial Analysis
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:mt-4 sm:text-lg">
          Leverage AI to forecast your future or ask specific questions about your transaction history.
        </p>
      </div>
      
       <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Verify AI Output</AlertTitle>
          <AlertDescription>
            AI can make mistakes. Please review the generated analysis carefully and verify its accuracy against your own records.
          </AlertDescription>
        </Alert>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>Generate Your Analysis</CardTitle>
          <CardDescription>Enter a specific question or leave it blank for a general cash flow projection.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="space-y-2">
                <Label htmlFor="user-prompt">Your Question (Optional)</Label>
                <Textarea
                    id="user-prompt"
                    placeholder="e.g., 'What are my top 3 spending categories this month?' or 'How does my income compare to last month?'"
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    rows={3}
                    className="min-h-28 resize-y"
                />
            </div>
          {!userDataLoading && !hasTransactions && (
            <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm">
              <p className="font-medium">Add a transaction before generating an analysis.</p>
              <p className="mt-1 text-muted-foreground">
                Ledgerly needs some financial history to create a useful projection.
              </p>
              <Button asChild variant="outline" className="mt-4 h-11 w-full sm:w-auto">
                <Link href="/transactions">
                  Go to transactions
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
          <Button
            onClick={handleGenerateProjection}
            disabled={loading || userDataLoading || !hasTransactions}
            size="lg"
            className="h-12 w-full"
          >
            {loading || userDataLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {loading ? "Analyzing Data..." : "Loading Transaction History..."}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {loading && (
        <Card aria-live="polite" aria-busy="true">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Generating...</CardTitle>
            <CardDescription>
              Reviewing your transaction history. This may take a moment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      )}

      {error && (
        <div ref={resultRef} tabIndex={-1} className="scroll-mt-24 outline-none">
          <Alert variant="destructive">
            <AlertTitle>Analysis unavailable</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{error}</p>
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateProjection}
                disabled={loading || !hasTransactions}
                className="h-11 w-full border-destructive/40 sm:w-auto"
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {projection && (
        <Card
          ref={resultRef}
          tabIndex={-1}
          className="min-w-0 scroll-mt-24 overflow-hidden bg-primary/5 outline-none"
          aria-live="polite"
        >
          <CardHeader className="p-4 sm:p-6">
             <CardTitle className="flex items-start gap-2">
              <Sparkles className="mt-0.5 shrink-0 text-primary"/>
              <span>Your AI-Powered Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto whitespace-pre-wrap break-words rounded-md border bg-background/50 p-3 sm:p-4">
              {projection}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ProjectionsPage() {
    return (
        <FeatureGate>
            <ProjectionsPageContent />
        </FeatureGate>
    )
}
