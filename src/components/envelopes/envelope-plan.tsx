"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  Landmark,
  PlusCircle,
  RotateCcw,
  Settings2,
  Target,
  WalletCards,
} from "lucide-react";

import { NewTransferSheet } from "@/components/new-transfer-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/hooks/use-accounts";
import { useAuth } from "@/hooks/use-auth";
import {
  type NewEnvelope,
  useEnvelopes,
} from "@/hooks/use-envelopes";
import { useToast } from "@/hooks/use-toast";
import {
  useAllTransactions,
  useTransactionData,
} from "@/hooks/use-transactions";
import {
  calculateAccountBalance,
  type TransferInput,
} from "@/lib/accounts";
import { calculateUnassignedCash } from "@/lib/envelopes";
import type {
  Category,
  Envelope,
  EnvelopeFundingFrequency,
  EnvelopeRollover,
  EnvelopeType,
  SubCategory,
  TransferPurpose,
} from "@/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const ENVELOPE_TYPE_LABELS: Record<EnvelopeType, string> = {
  "monthly-spending": "Monthly spending",
  bills: "Bills reserve",
  "sinking-fund": "Sinking fund",
  savings: "Savings goal",
  buffer: "Operating buffer",
};

const ENVELOPE_COLORS = [
  "#285943",
  "#293a5e",
  "#0f766e",
  "#7c3aed",
  "#b45309",
  "#be123c",
];

function categoryOptions(categories: Category[]) {
  const flatten = (
    items: (Category | SubCategory)[],
    path: string[] = [],
  ): { label: string; value: string }[] =>
    items.flatMap((item) => {
      const nextPath = [...path, item.name];
      return [
        { label: nextPath.join(" › "), value: item.id },
        ...(item.subCategories
          ? flatten(item.subCategories, nextPath)
          : []),
      ];
    });
  return flatten(categories.filter((category) => category.type === "expense"));
}

function defaultDraft(priority: number): NewEnvelope {
  return {
    name: "",
    type: "sinking-fund",
    backingAccountId: "",
    categoryIds: [],
    targetAmount: 0,
    fundingFrequency: "manual",
    fundingAmount: 0,
    priority,
    rollover: "rollover",
    color: ENVELOPE_COLORS[priority % ENVELOPE_COLORS.length],
    icon: "WalletCards",
  };
}

function EnvelopeEditor({
  open,
  onOpenChange,
  categories,
  editingEnvelope,
  accountBalances,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  editingEnvelope?: Envelope;
  accountBalances: Map<string, number>;
}) {
  const { accounts, activeAccounts, primaryAccountId } = useAccounts();
  const {
    envelopes,
    addEnvelope,
    updateEnvelope,
  } = useEnvelopes();
  const { toast } = useToast();
  const [draft, setDraft] = useState<NewEnvelope>(
    defaultDraft(envelopes.length),
  );
  const [startingAllocation, setStartingAllocation] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStartingAllocation("0");
    setDraft(
      editingEnvelope
        ? {
            name: editingEnvelope.name,
            type: editingEnvelope.type,
            backingAccountId: editingEnvelope.backingAccountId,
            categoryIds: editingEnvelope.categoryIds,
            targetAmount: editingEnvelope.targetAmount,
            targetDate: editingEnvelope.targetDate,
            dueDay: editingEnvelope.dueDay,
            fundingFrequency: editingEnvelope.fundingFrequency,
            fundingAmount: editingEnvelope.fundingAmount,
            paycheckPercentage: editingEnvelope.paycheckPercentage,
            priority: editingEnvelope.priority,
            rollover: editingEnvelope.rollover,
            color: editingEnvelope.color,
            icon: editingEnvelope.icon,
          }
        : defaultDraft(envelopes.length),
    );
  }, [editingEnvelope, envelopes.length, open]);

  const usedBackingAccounts = new Set(
    envelopes
      .filter(
        (envelope) =>
          !envelope.isArchived && envelope.id !== editingEnvelope?.id,
      )
      .map((envelope) => envelope.backingAccountId)
      .filter(Boolean),
  );
  const availableAccounts = activeAccounts.filter(
    (account) =>
      account.classification === "asset" &&
      (!usedBackingAccounts.has(account.id) ||
        account.id === editingEnvelope?.backingAccountId),
  );
  const selectedAccount = accounts.find(
    (account) => account.id === draft.backingAccountId,
  );

  const save = async () => {
    if (!draft.name.trim() || !draft.backingAccountId) {
      setError("Enter a name and choose the account backing this envelope.");
      return;
    }
    const allocation = Number(startingAllocation);
    if (!editingEnvelope && (!Number.isFinite(allocation) || allocation < 0)) {
      setError("Starting allocation must be zero or greater.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const values: NewEnvelope = {
        ...draft,
        name: draft.name.trim(),
        targetAmount: Math.max(0, Number(draft.targetAmount) || 0),
        fundingAmount: Math.max(0, Number(draft.fundingAmount) || 0),
        paycheckPercentage: Math.min(
          100,
          Math.max(0, Number(draft.paycheckPercentage) || 0),
        ),
        dueDay: draft.dueDay
          ? Math.min(31, Math.max(1, Number(draft.dueDay)))
          : undefined,
      };
      if (editingEnvelope) {
        await updateEnvelope(editingEnvelope.id, values);
      } else {
        await addEnvelope(values, allocation);
      }
      toast({
        title: editingEnvelope ? "Envelope updated" : "Envelope ready",
        description: editingEnvelope
          ? `${values.name} has been updated.`
          : `${values.name} is ready to fund and use.`,
      });
      onOpenChange(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The envelope could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingEnvelope ? "Edit envelope" : "Set up an envelope"}
          </DialogTitle>
          <DialogDescription>
            Connect a real account to a purpose without changing how Ledgerly
            calculates income or expenses.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="envelope-name">Envelope name</Label>
            <Input
              id="envelope-name"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Travel, Bills, Mad Money…"
            />
          </div>
          <div className="space-y-2">
            <Label>Purpose</Label>
            <Select
              value={draft.type}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  type: value as EnvelopeType,
                }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ENVELOPE_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Backing account</Label>
            <Select
              value={draft.backingAccountId}
              onValueChange={(value) => {
                setDraft((current) => ({
                  ...current,
                  backingAccountId: value,
                }));
                if (!editingEnvelope) {
                  setStartingAllocation(
                    Math.max(0, accountBalances.get(value) ?? 0).toFixed(2),
                  );
                }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
              <SelectContent>
                {availableAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                    {account.id === primaryAccountId ? " (Main)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              One active envelope can be backed by each account.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="envelope-target">Target amount</Label>
            <Input
              id="envelope-target"
              type="number"
              min="0"
              step="0.01"
              value={draft.targetAmount ?? 0}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  targetAmount: Number(event.target.value),
                }))
              }
            />
          </div>
          {!editingEnvelope ? (
            <div className="space-y-2">
              <Label htmlFor="starting-allocation">
                Confirm starting allocation
              </Label>
              <Input
                id="starting-allocation"
                type="number"
                min="0"
                step="0.01"
                value={startingAllocation}
                onChange={(event) =>
                  setStartingAllocation(event.target.value)
                }
              />
              <p className="text-xs text-muted-foreground">
                {selectedAccount
                  ? `The current Ledgerly balance is ${currency.format(
                      accountBalances.get(selectedAccount.id) ?? 0,
                    )}. Confirm the amount that is already reserved.`
                  : "Choose an account, then confirm how much is already reserved."}
              </p>
            </div>
          ) : null}
          <div className="space-y-2 sm:col-span-2">
            <Label>Spending categories</Label>
            <SearchableMultiSelect
              options={categoryOptions(categories)}
              selected={draft.categoryIds}
              onChange={(categoryIds) =>
                setDraft((current) => ({ ...current, categoryIds }))
              }
              placeholder="Select categories used by this envelope"
            />
          </div>
          <div className="space-y-2">
            <Label>Funding plan</Label>
            <Select
              value={draft.fundingFrequency}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  fundingFrequency: value as EnvelopeFundingFrequency,
                }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="paycheck">Every paycheck</SelectItem>
                <SelectItem value="target-date">By target date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="funding-amount">Suggested funding amount</Label>
            <Input
              id="funding-amount"
              type="number"
              min="0"
              step="0.01"
              value={draft.fundingAmount ?? 0}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  fundingAmount: Number(event.target.value),
                }))
              }
            />
          </div>
          {draft.fundingFrequency === "paycheck" ? (
            <div className="space-y-2">
              <Label htmlFor="paycheck-percent">Paycheck percentage</Label>
              <Input
                id="paycheck-percent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={draft.paycheckPercentage ?? 0}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    paycheckPercentage: Number(event.target.value),
                  }))
                }
              />
            </div>
          ) : null}
          {draft.type === "bills" ? (
            <div className="space-y-2">
              <Label htmlFor="due-day">Typical due day</Label>
              <Input
                id="due-day"
                type="number"
                min="1"
                max="31"
                value={draft.dueDay ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    dueDay: Number(event.target.value) || undefined,
                  }))
                }
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Period end behavior</Label>
            <Select
              value={draft.rollover}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  rollover: value as EnvelopeRollover,
                }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rollover">Keep the balance</SelectItem>
                <SelectItem value="reset">Review and reset</SelectItem>
                <SelectItem value="sweep">Review and sweep extra</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {ENVELOPE_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() =>
                    setDraft((current) => ({ ...current, color }))
                  }
                  aria-label={`Use color ${color}`}
                  aria-pressed={draft.color === color}
                  className="h-9 w-9 rounded-full border-2 shadow-sm"
                  style={{
                    backgroundColor: color,
                    borderColor:
                      draft.color === color ? "#1a1f24" : "transparent",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : editingEnvelope ? "Save changes" : "Create envelope"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentDialog({
  envelope,
  open,
  onOpenChange,
}: {
  envelope?: Envelope;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addAdjustment } = useEnvelopes();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust {envelope?.name}</DialogTitle>
          <DialogDescription>
            Use adjustments only to correct the envelope ledger. Positive
            amounts add assigned money; negative amounts remove it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adjustment-amount">Adjustment</Label>
            <Input
              id="adjustment-amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="-25.00 or 25.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjustment-note">Reason</Label>
            <Input
              id="adjustment-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Why is this adjustment needed?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (!envelope) return;
              void addAdjustment(envelope.id, Number(amount), note).then(() => {
                toast({ title: "Envelope adjusted" });
                onOpenChange(false);
              });
            }}
          >
            Save adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EnvelopePlan({ categories }: { categories: Category[] }) {
  const { activeYear, envelopeSettings } = useAuth();
  const { accounts, activeAccounts, primaryAccountId } = useAccounts();
  const {
    envelopes,
    activeEnvelopes,
    restoreEnvelope,
    loading: envelopesLoading,
    getSummaries,
  } = useEnvelopes();
  const { addTransfer } = useTransactionData();
  const {
    transactions,
    loading: transactionsLoading,
  } = useAllTransactions({ respectAccountFilter: false });
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope>();
  const [adjustingEnvelope, setAdjustingEnvelope] = useState<Envelope>();
  const [transferAction, setTransferAction] = useState<{
    purpose: TransferPurpose;
    envelopeId: string;
    relatedEnvelopeId?: string;
    amount?: number;
  }>();

  const monthStart = new Date(activeYear, new Date().getMonth(), 1);
  const monthEnd = new Date(activeYear, new Date().getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);
  const isReadOnly = activeYear < new Date().getFullYear();
  const periodTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          new Date(transaction.date).getTime() <= monthEnd.getTime(),
      ),
    // monthEnd is represented by stable activeYear/current-month primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeYear, transactions, monthEnd.getMonth()],
  );
  const summaries = useMemo(
    () => getSummaries({ from: monthStart, to: monthEnd }),
    // getSummaries changes when envelope events change. Month timestamps are
    // intentionally represented by their stable year/month primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getSummaries, activeYear, monthStart.getMonth()],
  );
  const accountBalances = useMemo(
    () =>
      new Map(
        accounts.map((account) => [
          account.id,
          calculateAccountBalance(account, periodTransactions),
        ]),
      ),
    [accounts, periodTransactions],
  );
  const totalAvailable = summaries.reduce(
    (total, summary) => total + summary.available,
    0,
  );
  const totalPending = summaries.reduce(
    (total, summary) => total + summary.pendingCommitted,
    0,
  );
  const totalSpendable = summaries.reduce(
    (total, summary) => total + summary.spendableAvailable,
    0,
  );
  const totalFunded = summaries.reduce(
    (total, summary) => total + summary.funded,
    0,
  );
  const totalSpent = summaries.reduce(
    (total, summary) => total + summary.spent,
    0,
  );
  const reservedInOperating = summaries.reduce(
    (total, summary) => total + summary.reservedInOperating,
    0,
  );
  const unassigned = calculateUnassignedCash({
    accounts,
    transactions: periodTransactions,
    summaries,
    minimumOperatingBalance: envelopeSettings.minimumOperatingBalance,
  });
  const underfunded = summaries.filter(
    (summary) => summary.status !== "healthy",
  );
  const latestPaycheck = periodTransactions.find(
    (transaction) =>
      transaction.type === "income" &&
      transaction.accountId === primaryAccountId &&
      new Date(transaction.date).getTime() >= monthStart.getTime(),
  );
  const recommendedFunding = (summary: (typeof summaries)[number]) => {
    const envelope = summary.envelope;
    if (envelope.fundingFrequency === "paycheck" && latestPaycheck) {
      return Math.min(
        summary.targetGap || Number.POSITIVE_INFINITY,
        Math.abs(latestPaycheck.amount) *
          ((envelope.paycheckPercentage ?? 0) / 100),
      );
    }
    if (envelope.fundingFrequency === "monthly") {
      return Math.min(
        summary.targetGap || Number.POSITIVE_INFINITY,
        envelope.fundingAmount ?? summary.targetGap,
      );
    }
    return envelope.fundingFrequency === "target-date"
      ? summary.targetGap
      : 0;
  };

  const transferInitialValues = useMemo<Partial<TransferInput> | undefined>(
    () => {
      if (!transferAction || !primaryAccountId) return undefined;
      const envelope = activeEnvelopes.find(
        (candidate) => candidate.id === transferAction.envelopeId,
      );
      const related = activeEnvelopes.find(
        (candidate) => candidate.id === transferAction.relatedEnvelopeId,
      );
      if (!envelope?.backingAccountId) return undefined;
      const purpose = transferAction.purpose;
      const sourceAccountId =
        purpose === "fund-envelope" || purpose === "return-unused"
          ? primaryAccountId
          : envelope.backingAccountId;
      const destinationAccountId =
        purpose === "fund-envelope" || purpose === "return-unused"
          ? envelope.backingAccountId
          : purpose === "reallocate" && related?.backingAccountId
            ? related.backingAccountId
            : primaryAccountId;
      return {
        purpose,
        envelopeId: envelope.id,
        relatedEnvelopeId: related?.id,
        sourceAccountId,
        destinationAccountId,
        description:
          purpose === "fund-envelope"
            ? `Fund ${envelope.name}`
            : purpose === "release-to-spend"
              ? `Release ${envelope.name} money to spend`
              : purpose === "return-unused"
                ? `Return unused ${envelope.name} money`
                : purpose === "unassign"
                  ? `Unassign money from ${envelope.name}`
                  : `Move money from ${envelope.name} to ${related?.name ?? "another envelope"}`,
        ...(transferAction.amount && transferAction.amount > 0
          ? { amount: transferAction.amount }
          : {}),
      };
    }, [activeEnvelopes, primaryAccountId, transferAction],
  );

  const firstPositive = summaries.find((summary) => summary.available > 0);
  const firstOverspent = summaries.find((summary) => summary.available < 0);

  if (envelopesLoading || transactionsLoading) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Loading envelope plan…</CardContent></Card>;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-headline text-2xl font-bold">
            <WalletCards className="h-6 w-6" /> Envelope plan
          </h2>
          <p className="text-muted-foreground">
            Assign real cash to a purpose while account transfers remain outside cash flow.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {firstPositive && firstOverspent ? (
            <Button
              variant="outline"
              disabled={isReadOnly}
              onClick={() =>
                setTransferAction({
                  purpose: "reallocate",
                  envelopeId: firstPositive.envelope.id,
                  relatedEnvelopeId: firstOverspent.envelope.id,
                })
              }
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Cover overspending
            </Button>
          ) : null}
          <Button
            onClick={() => {
              setEditingEnvelope(undefined);
              setEditorOpen(true);
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add envelope
          </Button>
        </div>
      </div>

      {activeEnvelopes.length === 0 ? (
        <Card className="border-primary/30 bg-secondary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" /> Set up account-backed envelopes
            </CardTitle>
            <CardDescription>
              Choose a Main account, connect purpose-specific accounts, and confirm the money already reserved in each one.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => setEditorOpen(true)}>
              Start with my first envelope
            </Button>
            <Button variant="outline" asChild>
              <Link href="/accounts">Review my accounts</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardDescription>Ready to assign</CardDescription><CardTitle className={unassigned < 0 ? "text-destructive" : ""}>{currency.format(unassigned)}</CardTitle></CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Total available</CardDescription><CardTitle>{currency.format(totalAvailable)}</CardTitle></CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Pending commitments</CardDescription><CardTitle>{currency.format(totalPending)}</CardTitle></CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Spendable after pending</CardDescription><CardTitle>{currency.format(totalSpendable)}</CardTitle></CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Funded this month</CardDescription><CardTitle>{currency.format(totalFunded)}</CardTitle></CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Spent this month</CardDescription><CardTitle>{currency.format(totalSpent)}</CardTitle></CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Reserved in Main</CardDescription><CardTitle>{currency.format(reservedInOperating)}</CardTitle></CardHeader>
            </Card>
          </div>

          {unassigned < 0 ? (
            <div className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div><p className="font-semibold">More money is assigned than Ledgerly can find in active cash accounts.</p><p className="text-muted-foreground">Review starting allocations or reconcile the backing accounts. Ledgerly will not silently cover the difference.</p></div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {summaries.map((summary) => {
              const envelope = summary.envelope;
              const backingBalance = envelope.backingAccountId
                ? accountBalances.get(envelope.backingAccountId) ?? 0
                : 0;
              const account = activeAccounts.find(
                (candidate) => candidate.id === envelope.backingAccountId,
              );
              return (
                <Card key={envelope.id} className="overflow-hidden">
                  <div className="h-1.5" style={{ backgroundColor: envelope.color }} />
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate">{envelope.name}</CardTitle>
                        <CardDescription>{ENVELOPE_TYPE_LABELS[envelope.type]} · {account?.name ?? "No backing account"}</CardDescription>
                      </div>
                      <Badge variant={summary.status === "overspent" ? "destructive" : summary.status === "underfunded" ? "outline" : "secondary"}>
                        {summary.status === "overspent" ? "Overspent" : summary.status === "underfunded" ? "Underfunded" : "On track"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Available</p>
                      <p className={`font-headline text-3xl font-semibold ${summary.available < 0 ? "text-destructive" : ""}`}>{currency.format(summary.available)}</p>
                      {summary.pendingCommitted > 0 ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {currency.format(summary.pendingCommitted)} pending · {currency.format(summary.spendableAvailable)} spendable after pending
                        </p>
                      ) : null}
                    </div>
                    {envelope.targetAmount ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground"><span>{Math.max(0, Math.min(100, summary.progress)).toFixed(0)}% funded</span><span>{currency.format(summary.targetGap)} to go</span></div>
                        <Progress value={Math.max(0, Math.min(100, summary.progress))} />
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/45 p-3 text-sm">
                      <div><p className="text-xs text-muted-foreground">Backing account</p><p className="font-medium">{currency.format(backingBalance)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Reserved in Main</p><p className="font-medium">{currency.format(summary.reservedInOperating)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Funded</p><p className="font-medium">{currency.format(summary.funded)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Spent</p><p className="font-medium">{currency.format(summary.spent)}</p></div>
                    </div>
                    {envelope.fundingFrequency !== "manual" ? (
                      <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="h-4 w-4" /> {envelope.fundingFrequency === "monthly" ? `${currency.format(envelope.fundingAmount ?? 0)} suggested monthly` : envelope.fundingFrequency === "paycheck" ? `${envelope.paycheckPercentage || 0}% of each paycheck suggested` : `Fund toward ${currency.format(envelope.targetAmount ?? 0)}`}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={isReadOnly} onClick={() => setTransferAction({ purpose: "fund-envelope", envelopeId: envelope.id, amount: recommendedFunding(summary) || undefined })}>
                        <ArrowDownToLine className="mr-1.5 h-4 w-4" /> Fund
                      </Button>
                      <Button size="sm" variant="outline" disabled={isReadOnly} onClick={() => setTransferAction({ purpose: "release-to-spend", envelopeId: envelope.id })}>
                        <ArrowUpFromLine className="mr-1.5 h-4 w-4" /> Release
                      </Button>
                      <Button size="sm" variant="ghost" asChild><Link href={`/budgets/envelopes/${envelope.id}`}>Details</Link></Button>
                      <Button size="icon" variant="ghost" aria-label={`Edit ${envelope.name}`} onClick={() => { setEditingEnvelope(envelope); setEditorOpen(true); }}><Edit3 className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" disabled={isReadOnly} aria-label={`Adjust ${envelope.name}`} onClick={() => setAdjustingEnvelope(envelope)}><Settings2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {envelopeSettings.fundingSuggestions && underfunded.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Needs attention</CardTitle><CardDescription>Ledgerly suggests actions but never moves money automatically.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {underfunded.map((summary) => (
                  <div key={summary.envelope.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      {summary.status === "overspent" ? <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" /> : <CircleDollarSign className="mt-0.5 h-5 w-5 text-amber-600" />}
                      <div><p className="font-medium">{summary.envelope.name}</p><p className="text-sm text-muted-foreground">{summary.status === "overspent" ? `${currency.format(Math.abs(summary.available))} needs to be covered.` : `${currency.format(summary.targetGap)} remains to reach the target.`}</p></div>
                    </div>
                    <Button size="sm" variant="outline" disabled={isReadOnly} onClick={() => setTransferAction({ purpose: "fund-envelope", envelopeId: summary.envelope.id, amount: recommendedFunding(summary) || undefined })}>Review transfer</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : envelopeSettings.fundingSuggestions ? (
            <div className="flex items-center gap-2 rounded-xl border bg-secondary/30 p-4 text-sm"><CheckCircle2 className="h-5 w-5 text-emerald-700" /> All configured envelope targets are currently funded.</div>
          ) : null}

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> Envelope rules</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg border p-3"><p className="font-medium">Transfers move location</p><p className="mt-1 text-muted-foreground">Funding, releasing, and returning money never count as income or expense.</p></div>
              <div className="rounded-lg border p-3"><p className="font-medium">Expenses use the envelope</p><p className="mt-1 text-muted-foreground">Assign the purchase to an envelope when it posts to reduce available money once.</p></div>
              <div className="rounded-lg border p-3"><p className="font-medium">You stay in control</p><p className="mt-1 text-muted-foreground">Suggestions, funding plans, and period-end rules never move money without confirmation.</p></div>
            </CardContent>
          </Card>
          {envelopes.some((envelope) => envelope.isArchived) ? (
            <Card>
              <CardHeader><CardTitle>Archived envelopes</CardTitle><CardDescription>History is preserved and can be restored at any time.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {envelopes.filter((envelope) => envelope.isArchived).map((envelope) => (
                  <div key={envelope.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <span className="font-medium">{envelope.name}</span>
                    <Button size="sm" variant="outline" onClick={() => void restoreEnvelope(envelope.id)}>Restore</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      <EnvelopeEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        categories={categories}
        editingEnvelope={editingEnvelope}
        accountBalances={accountBalances}
      />
      <AdjustmentDialog
        envelope={adjustingEnvelope}
        open={Boolean(adjustingEnvelope)}
        onOpenChange={(open) => !open && setAdjustingEnvelope(undefined)}
      />
      {transferAction && transferInitialValues ? (
        <NewTransferSheet
          isOpen
          onOpenChange={(open) => !open && setTransferAction(undefined)}
          initialValues={transferInitialValues}
          onTransferCreated={async (transfer) => {
            await addTransfer(transfer);
            toast({
              title: "Envelope transfer recorded",
              description: "Account balances and the envelope ledger were updated together.",
            });
          }}
        />
      ) : null}
    </div>
  );
}
