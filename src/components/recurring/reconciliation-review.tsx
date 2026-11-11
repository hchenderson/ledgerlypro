"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertCircle, Check, Link2Off, Loader2, SkipForward, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import type { RecurringMatchCandidate } from "@/lib/recurring-reconciliation";
import type { RecurringOccurrence } from "@/types";

type SafeTransaction = {
  id: string;
  date: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  description: string;
  merchantName?: string;
  accountId?: string;
  postingStatus?: string;
  recurringOccurrenceId?: string;
};

type ReviewResponse = {
  occurrences: RecurringOccurrence[];
  candidates: RecurringMatchCandidate[];
  transactions: SafeTransaction[];
  migration: {
    persistedOccurrences: number;
    compatibleLegacyOccurrences: number;
    prefixOnlyRecordsRequiringReview: Array<{
      id: string;
      date: string;
      description: string;
      amount: number;
    }>;
  };
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function RecurringReconciliationReview() {
  const { user } = useAuth();
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingKey, setWorkingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch(user, "/api/recurring/reconcile");
      const body = (await response.json()) as ReviewResponse & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to load reconciliation review.");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load reconciliation review.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const transact = async (
    action: "confirm" | "unlink" | "dismiss" | "undo-dismiss" | "skip",
    occurrence: RecurringOccurrence,
    transactionId?: string,
  ) => {
    if (!user) return;
    const occurrenceId = occurrence.id;
    const key = `${action}:${occurrenceId}:${transactionId ?? ""}`;
    setWorkingKey(key);
    setError(null);
    try {
      const response = await authenticatedFetch(user, "/api/recurring/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          occurrenceId,
          transactionId,
          legacyTransactionId: occurrence.legacyTransactionId,
          operationId: crypto.randomUUID(),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Reconciliation action failed.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Reconciliation action failed.");
    } finally {
      setWorkingKey(null);
    }
  };

  const transactionById = useMemo(
    () => new Map((data?.transactions ?? []).map((transaction) => [transaction.id, transaction])),
    [data?.transactions],
  );
  const occurrenceById = useMemo(
    () => new Map((data?.occurrences ?? []).map((occurrence) => [occurrence.id, occurrence])),
    [data?.occurrences],
  );
  const reviewCandidates = data?.candidates ?? [];
  const linked = (data?.occurrences ?? []).flatMap((occurrence) =>
    occurrence.matches
      .filter((match) => match.status === "confirmed")
      .map((match) => ({ occurrence, match })),
  );
  const exceptions = (data?.occurrences ?? []).filter(
    (occurrence) => occurrence.status === "exception",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Check className="h-5 w-5" /> Reconcile recurring activity
        </CardTitle>
        <CardDescription>
          Suggestions require confirmation. A confirmed bank transaction replaces that occurrence&apos;s remaining forecast amount.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Reconciliation needs attention</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking occurrences and posted transactions…
          </div>
        ) : null}

        {!loading && reviewCandidates.length === 0 && exceptions.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No recurring matches need review right now.
          </div>
        ) : null}

        {reviewCandidates.map((candidate) => {
          const occurrence = occurrenceById.get(candidate.occurrenceId);
          const transaction = transactionById.get(candidate.transactionId);
          if (!occurrence || !transaction) return null;
          const confirmKey = `confirm:${occurrence.id}:${transaction.id}`;
          const dismissKey = `dismiss:${occurrence.id}:${transaction.id}`;
          return (
            <div key={`${occurrence.id}:${transaction.id}`} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{occurrence.description}</p>
                    {candidate.ambiguous ? <Badge variant="destructive">Multiple candidates</Badge> : <Badge variant="secondary">Suggested</Badge>}
                    {occurrence.status === "partially-fulfilled" ? <Badge variant="outline">Partial</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Due {format(parseISO(occurrence.originalDueDate), "MMM d, yyyy")} • expected {currency.format(occurrence.expectedAmount)} • remaining {currency.format(occurrence.remainingAmount)}
                  </p>
                  <p className="mt-2 text-sm">
                    {transaction.merchantName ?? transaction.description} posted {format(parseISO(transaction.date), "MMM d")} for {currency.format(transaction.amount)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Why: {candidate.reasons.join("; ")}.</p>
                </div>
                <div className="flex flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button
                    size="sm"
                    onClick={() => void transact("confirm", occurrence, transaction.id)}
                    disabled={workingKey !== null}
                  >
                    {workingKey === confirmKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void transact("dismiss", occurrence, transaction.id)}
                    disabled={workingKey !== null}
                  >
                    {workingKey === dismissKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    Not a match
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void transact("skip", occurrence)}
                    disabled={workingKey !== null}
                  >
                    <SkipForward className="h-4 w-4" /> Skip occurrence
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {exceptions.map((occurrence) => (
          <Alert key={occurrence.id} variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{occurrence.description} returned to the forecast</AlertTitle>
            <AlertDescription>
              {occurrence.exceptionReason ?? "A linked transaction became ineligible."} Remaining expectation: {currency.format(occurrence.remainingAmount)}. Ledgerly will not choose another transaction automatically.
            </AlertDescription>
          </Alert>
        ))}

        {linked.length > 0 ? (
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">Confirmed links ({linked.length})</summary>
            <div className="mt-3 space-y-3">
              {linked.map(({ occurrence, match }) => {
                const transaction = transactionById.get(match.transactionId);
                return (
                  <div key={`${occurrence.id}:${match.transactionId}`} className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm">
                      <p className="font-medium">{occurrence.description} → {transaction?.description ?? match.transactionId}</p>
                      <p className="text-muted-foreground">Actual {currency.format(match.amount)} • expected {currency.format(occurrence.expectedAmount)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void transact("unlink", occurrence, match.transactionId)}
                      disabled={workingKey !== null}
                    >
                      <Link2Off className="h-4 w-4" /> Undo link
                    </Button>
                  </div>
                );
              })}
            </div>
          </details>
        ) : null}

        {(data?.migration.compatibleLegacyOccurrences ?? 0) > 0 ||
        (data?.migration.prefixOnlyRecordsRequiringReview.length ?? 0) > 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Legacy recurring records detected</AlertTitle>
            <AlertDescription>
              {data?.migration.compatibleLegacyOccurrences ?? 0} records have explicit recurring provenance and can be reconciled safely. {data?.migration.prefixOnlyRecordsRequiringReview.length ?? 0} description-only records require manual review and were not reclassified.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
