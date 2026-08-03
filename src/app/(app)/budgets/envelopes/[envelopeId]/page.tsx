"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  Landmark,
  ReceiptText,
  WalletCards,
} from "lucide-react";

import { NewTransferSheet } from "@/components/new-transfer-sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAccountReconciliations } from "@/hooks/use-account-reconciliations";
import { useAccounts } from "@/hooks/use-accounts";
import { useAuth } from "@/hooks/use-auth";
import { useEnvelopes } from "@/hooks/use-envelopes";
import { useToast } from "@/hooks/use-toast";
import {
  useAllTransactions,
  useTransactionData,
} from "@/hooks/use-transactions";
import {
  calculateAccountBalance,
  type TransferInput,
} from "@/lib/accounts";
import type { EnvelopeEvent, TransferPurpose } from "@/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const eventLabels: Record<EnvelopeEvent["type"], string> = {
  "starting-allocation": "Starting allocation",
  fund: "Funded",
  release: "Released to Main",
  return: "Returned to backing account",
  expense: "Spent",
  refund: "Refund",
  unassign: "Unassigned",
  "reassign-in": "Reallocated in",
  "reassign-out": "Reallocated out",
  adjustment: "Manual adjustment",
};

function eventSign(event: EnvelopeEvent) {
  if (
    event.type === "expense" ||
    event.type === "unassign" ||
    event.type === "reassign-out"
  ) {
    return "−";
  }
  if (event.type === "release" || event.type === "return") return "";
  return event.amount >= 0 ? "+" : "−";
}

export default function EnvelopeDetailPage() {
  const params = useParams<{ envelopeId: string }>();
  const router = useRouter();
  const { activeYear } = useAuth();
  const isReadOnly = activeYear < new Date().getFullYear();
  const { getEnvelope, events, getSummaries, archiveEnvelope, loading } = useEnvelopes();
  const { accounts, primaryAccountId } = useAccounts();
  const { addTransfer } = useTransactionData();
  const { transactions } = useAllTransactions({
    respectAccountFilter: false,
  });
  const { toast } = useToast();
  const envelope = getEnvelope(params.envelopeId);
  const { reconciliations } = useAccountReconciliations(
    envelope?.backingAccountId,
  );
  const [action, setAction] = useState<TransferPurpose>();
  const summary = getSummaries().find(
    (candidate) => candidate.envelope.id === params.envelopeId,
  );
  const backingAccount = accounts.find(
    (account) => account.id === envelope?.backingAccountId,
  );
  const backingBalance =
    backingAccount
      ? calculateAccountBalance(backingAccount, transactions)
      : 0;
  const envelopeEvents = useMemo(
    () =>
      events
        .filter((event) => event.envelopeId === params.envelopeId)
        .sort(
          (left, right) =>
            new Date(right.date).getTime() -
              new Date(left.date).getTime() ||
            right.id.localeCompare(left.id),
        ),
    [events, params.envelopeId],
  );
  const assignedTransactions = useMemo(
    () =>
      transactions
        .filter(
          (transaction) =>
            transaction.envelopeId === params.envelopeId &&
            transaction.type === "expense",
        )
        .sort(
          (left, right) =>
            new Date(right.date).getTime() -
            new Date(left.date).getTime(),
        ),
    [params.envelopeId, transactions],
  );
  const latestReconciliation = reconciliations[0];

  const transferInitialValues = useMemo<Partial<TransferInput> | undefined>(
    () => {
      if (
        !action ||
        !envelope?.backingAccountId ||
        !primaryAccountId
      ) {
        return undefined;
      }
      const fromMain =
        action === "fund-envelope" || action === "return-unused";
      return {
        purpose: action,
        envelopeId: envelope.id,
        sourceAccountId: fromMain
          ? primaryAccountId
          : envelope.backingAccountId,
        destinationAccountId: fromMain
          ? envelope.backingAccountId
          : primaryAccountId,
        description:
          action === "fund-envelope"
            ? `Fund ${envelope.name}`
            : action === "release-to-spend"
              ? `Release ${envelope.name} money to spend`
              : action === "return-unused"
                ? `Return unused ${envelope.name} money`
                : `Unassign money from ${envelope.name}`,
      };
    }, [action, envelope, primaryAccountId],
  );

  if (loading) {
    return <p className="text-muted-foreground">Loading envelope…</p>;
  }
  if (!envelope || !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Envelope not found</CardTitle>
          <CardDescription>
            It may have been removed or is not available to this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><Link href="/budgets">Return to budgets</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-3">
            <Link href="/budgets"><ArrowLeft className="mr-2 h-4 w-4" /> Envelope plan</Link>
          </Button>
          <h1 className="flex items-center gap-3 font-headline text-3xl font-bold">
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: envelope.color }} />
            {envelope.name}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Backed by {backingAccount?.name ?? "an unavailable account"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={isReadOnly} onClick={() => setAction("fund-envelope")}>Fund</Button>
          <Button disabled={isReadOnly} variant="outline" onClick={() => setAction("release-to-spend")}>Release to Main</Button>
          <Button disabled={isReadOnly} variant="outline" onClick={() => setAction("return-unused")}>Return unused</Button>
          <Button disabled={isReadOnly} variant="ghost" onClick={() => setAction("unassign")}>Unassign</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost">Archive</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive {envelope.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Its event and spending history will be preserved. The backing account and its transactions will not be changed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void archiveEnvelope(envelope.id).then(() => router.push('/budgets'))}>Archive envelope</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {latestReconciliation?.status === "needs-review" ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Backing account needs reconciliation</AlertTitle>
          <AlertDescription>
            Resolve the latest {backingAccount?.name} statement difference before relying on this envelope’s physical balance.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card><CardHeader><CardDescription>Available</CardDescription><CardTitle className={summary.available < 0 ? "text-destructive" : ""}>{currency.format(summary.available)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Pending commitments</CardDescription><CardTitle>{currency.format(summary.pendingCommitted)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Spendable after pending</CardDescription><CardTitle>{currency.format(summary.spendableAvailable)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>In backing account</CardDescription><CardTitle>{currency.format(backingBalance)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Reserved in Main</CardDescription><CardTitle>{currency.format(summary.reservedInOperating)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Target remaining</CardDescription><CardTitle>{currency.format(summary.targetGap)}</CardTitle></CardHeader></Card>
      </div>

      {envelope.targetAmount ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" /> Funding progress</CardTitle>
            <CardDescription>{currency.format(summary.available)} available toward a {currency.format(envelope.targetAmount)} target.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={Math.max(0, Math.min(100, summary.progress))} />
            <p className="text-right text-sm text-muted-foreground">{Math.max(0, summary.progress).toFixed(1)}%</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> Envelope history</CardTitle><CardDescription>Allocation events are separate from income and expense reporting.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {envelopeEvents.length === 0 ? <p className="py-8 text-center text-muted-foreground">No envelope activity yet.</p> : envelopeEvents.slice(0, 30).map((event) => (
              <div key={event.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0"><p className="font-medium">{eventLabels[event.type]}</p><p className="truncate text-xs text-muted-foreground">{new Date(event.date).toLocaleDateString()} · {event.note || "Envelope activity"}</p></div>
                <p className="shrink-0 font-medium tabular-nums">{eventSign(event)}{currency.format(Math.abs(event.amount))}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5" /> Assigned spending</CardTitle><CardDescription>Purchases reduce this envelope exactly once.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {assignedTransactions.length === 0 ? <p className="py-8 text-center text-muted-foreground">No expenses have been assigned yet.</p> : assignedTransactions.slice(0, 30).map((transaction) => (
              <div key={transaction.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0"><p className="truncate font-medium">{transaction.description}</p><p className="text-xs text-muted-foreground">{new Date(transaction.date).toLocaleDateString()} · {transaction.category}</p></div>
                <p className="shrink-0 font-medium tabular-nums text-destructive">−{currency.format(Math.abs(transaction.amount))}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Account integrity</CardTitle></CardHeader>
        <CardContent className="flex items-start gap-3 text-sm">
          {latestReconciliation?.status === "reconciled" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />}
          <p>{latestReconciliation?.status === "reconciled" ? `The backing account was reconciled through ${latestReconciliation.statementDate}.` : "This backing account has not been reconciled yet. The envelope ledger remains available, but the physical account balance should be verified."}</p>
        </CardContent>
      </Card>

      {action && transferInitialValues ? (
        <NewTransferSheet
          isOpen
          onOpenChange={(open) => !open && setAction(undefined)}
          initialValues={transferInitialValues}
          onTransferCreated={async (transfer) => {
            await addTransfer(transfer);
            toast({ title: "Envelope transfer recorded" });
          }}
        />
      ) : null}
    </div>
  );
}
