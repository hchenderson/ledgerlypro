"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  Landmark,
  Pencil,
  PlusCircle,
  RotateCcw,
  WalletCards,
} from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaidConnectionsCard } from "@/components/plaid/plaid-connections-card";
import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";
import { useAccountReconciliations } from "@/hooks/use-account-reconciliations";
import { useAccounts } from "@/hooks/use-accounts";
import { useToast } from "@/hooks/use-toast";
import { useEnvelopes } from "@/hooks/use-envelopes";
import {
  useAllTransactions,
  useTransactionData,
} from "@/hooks/use-transactions";
import {
  ACCOUNT_TYPE_LABELS,
  calculateAccountBalance,
  displayAccountBalance,
  normalizeOpeningBalance,
} from "@/lib/accounts";
import {
  findTransferCandidates,
  type TransferCandidate,
} from "@/lib/transfer-matching";
import type {
  Account,
  AccountRole,
  AccountType,
  Envelope,
  TransferPurpose,
} from "@/types";

const NewTransferSheet = dynamic(
  () =>
    import("@/components/new-transfer-sheet").then(
      (module) => module.NewTransferSheet,
    ),
  { ssr: false },
);

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const ACCOUNT_ROLE_LABELS: Record<AccountRole, string> = {
  operating: "Main operating account",
  envelope: "Envelope account",
  debt: "Debt or credit account",
  standard: "Standard account",
};

interface TransferClassificationOption {
  value: TransferPurpose;
  label: string;
  envelopeId?: string;
  relatedEnvelopeId?: string;
}

function transferClassificationOptions(
  candidate: TransferCandidate,
  primaryAccountId: string | null,
  envelopes: Envelope[],
): TransferClassificationOption[] {
  const options: TransferClassificationOption[] = [
    { value: "ordinary", label: "Internal transfer only" },
  ];
  const sourceEnvelope = envelopes.find(
    (envelope) =>
      envelope.backingAccountId === candidate.outgoing.accountId,
  );
  const destinationEnvelope = envelopes.find(
    (envelope) =>
      envelope.backingAccountId === candidate.incoming.accountId,
  );

  if (
    candidate.outgoing.accountId === primaryAccountId &&
    destinationEnvelope
  ) {
    options.push(
      {
        value: "fund-envelope",
        label: `Fund ${destinationEnvelope.name}`,
        envelopeId: destinationEnvelope.id,
      },
      {
        value: "return-unused",
        label: `Return unused ${destinationEnvelope.name} money`,
        envelopeId: destinationEnvelope.id,
      },
    );
  } else if (
    sourceEnvelope &&
    candidate.incoming.accountId === primaryAccountId
  ) {
    options.push(
      {
        value: "release-to-spend",
        label: `Release ${sourceEnvelope.name} money to spend`,
        envelopeId: sourceEnvelope.id,
      },
      {
        value: "unassign",
        label: `Unassign money from ${sourceEnvelope.name}`,
        envelopeId: sourceEnvelope.id,
      },
    );
  } else if (sourceEnvelope && destinationEnvelope) {
    options.push({
      value: "reallocate",
      label: `Move ${sourceEnvelope.name} to ${destinationEnvelope.name}`,
      envelopeId: sourceEnvelope.id,
      relatedEnvelopeId: destinationEnvelope.id,
    });
  }

  return options;
}

function AccountDialog({
  account,
  open,
  onOpenChange,
}: {
  account?: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addAccount, updateAccount, setPrimaryAccount } = useAccounts();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [role, setRole] = useState<AccountRole>("standard");
  const [institution, setInstitution] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? "");
    setType(account?.type ?? "checking");
    setRole(
      account?.isDefault
        ? "operating"
        : account?.role ?? (account?.type === "credit" ? "debt" : "standard"),
    );
    setInstitution(account?.institution ?? "");
    setLastFour(account?.lastFour ?? "");
    setOpeningBalance(
      account
        ? displayAccountBalance(
            account,
            account.openingBalance,
          ).toString()
        : "",
    );
  }, [account, open]);

  const save = async () => {
    const normalizedName = name.trim();
    const numericBalance = Number(openingBalance || 0);
    if (!normalizedName || !Number.isFinite(numericBalance)) {
      toast({
        variant: "destructive",
        title: "Check the account details",
        description:
          "Enter an account name and a valid opening balance.",
      });
      return;
    }

    setSaving(true);
    try {
      const values = {
        name: normalizedName,
        type,
        role,
        openingBalance: normalizeOpeningBalance(
          type,
          numericBalance,
        ),
        institution: institution.trim() || undefined,
        lastFour:
          lastFour.replace(/\D/g, "").slice(-4) || undefined,
        ...(account?.openingBalanceEstimated
          ? { openingBalanceEstimated: false }
          : {}),
      };
      if (account) {
        await updateAccount(account.id, values);
        if (role === "operating" && !account.isDefault) {
          await setPrimaryAccount(account.id);
        }
      } else {
        const added = await addAccount(values);
        if (role === "operating") {
          await setPrimaryAccount(added.id);
        }
      }
      toast({
        title: account ? "Account updated" : "Account added",
        description: `${normalizedName} is ready to use.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Account could not be saved",
        description:
          error instanceof Error
            ? error.message
            : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {account ? "Edit account" : "Add an account"}
          </DialogTitle>
          <DialogDescription>
            {account
              ? "Update how this account appears and its opening balance."
              : "Add a checking, savings, credit, cash, or other account."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="account-name">Account name</Label>
            <Input
              id="account-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Household Checking"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-type">Account type</Label>
            <Select
              value={type}
              onValueChange={(value) => {
                const nextType = value as AccountType;
                setType(nextType);
                if (nextType === "credit") setRole("debt");
                else if (role === "debt") setRole("standard");
              }}
            >
              <SelectTrigger id="account-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-role">Budgeting role</Label>
            <Select
              value={account?.isDefault ? "operating" : role}
              disabled={Boolean(account?.isDefault)}
              onValueChange={(value) => setRole(value as AccountRole)}
            >
              <SelectTrigger id="account-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ACCOUNT_ROLE_LABELS).map(([value, label]) => (
                  <SelectItem
                    key={value}
                    value={value}
                    disabled={value === "operating" && type === "credit"}
                  >
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Making this the Main account safely moves the Primary designation. Connect Envelope accounts from the Budgets page.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-institution">
                Institution (optional)
              </Label>
              <Input
                id="account-institution"
                value={institution}
                onChange={(event) =>
                  setInstitution(event.target.value)
                }
                placeholder="Bank or provider"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-last-four">
                Last four digits (optional)
              </Label>
              <Input
                id="account-last-four"
                value={lastFour}
                onChange={(event) =>
                  setLastFour(
                    event.target.value.replace(/\D/g, "").slice(0, 4),
                  )
                }
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-opening-balance">
              {type === "credit"
                ? "Opening amount owed"
                : "Opening balance"}
            </Label>
            <Input
              id="account-opening-balance"
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(event) =>
                setOpeningBalance(event.target.value)
              }
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              This is the balance immediately before the first
              Ledgerly transaction for this account.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountIcon({ type }: { type: AccountType }) {
  if (type === "credit") return <CreditCard className="h-5 w-5" />;
  if (type === "cash") return <WalletCards className="h-5 w-5" />;
  if (type === "other") return <Building2 className="h-5 w-5" />;
  return <Landmark className="h-5 w-5" />;
}

export default function AccountsPage() {
  const {
    accounts,
    activeAccounts,
    loading: accountsLoading,
    archiveAccount,
    restoreAccount,
    getAccountName,
    primaryAccountId,
  } = useAccounts();
  const { activeEnvelopes } = useEnvelopes();
  const {
    transactions,
    loading: transactionsLoading,
  } = useAllTransactions({ respectAccountFilter: false });
  const { addTransfer, linkTransactionsAsTransfer } =
    useTransactionData();
  const {
    reconciliations,
    loading: reconciliationsLoading,
  } = useAccountReconciliations();
  const { toast } = useToast();
  const [editingAccount, setEditingAccount] =
    useState<Account>();
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [linkingCandidateId, setLinkingCandidateId] =
    useState<string | null>(null);
  const [transferPurposeByCandidate, setTransferPurposeByCandidate] =
    useState<Record<string, TransferPurpose>>({});

  const accountBalances = useMemo(
    () =>
      new Map(
        accounts.map((account) => [
          account.id,
          calculateAccountBalance(account, transactions),
        ]),
      ),
    [accounts, transactions],
  );

  const totals = useMemo(() => {
    let assets = 0;
    let debt = 0;
    let netWorth = 0;
    for (const account of accounts) {
      const balance = accountBalances.get(account.id) ?? 0;
      netWorth += balance;
      if (balance < 0) {
        debt += Math.abs(balance);
      } else {
        assets += balance;
      }
    }
    return { assets, debt, netWorth };
  }, [accountBalances, accounts]);

  const latestReconciliationByAccount = useMemo(() => {
    const latest = new Map(
      [] as [string, (typeof reconciliations)[number]][],
    );
    reconciliations.forEach((reconciliation) => {
      if (!latest.has(reconciliation.accountId)) {
        latest.set(reconciliation.accountId, reconciliation);
      }
    });
    return latest;
  }, [reconciliations]);

  const transferCandidates = useMemo(
    () =>
      activeAccounts.length > 1
        ? findTransferCandidates(transactions, { limit: 6 })
        : [],
    [activeAccounts.length, transactions],
  );

  const handleArchive = async (account: Account) => {
    try {
      await archiveAccount(account.id);
      toast({
        title: "Account archived",
        description:
          "Its history remains available in reports and account filters.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Account was not archived",
        description:
          error instanceof Error
            ? error.message
            : "Please try again.",
      });
    }
  };

  const handleLinkTransfer = async (
    candidate: TransferCandidate,
    classification: TransferClassificationOption,
  ) => {
    setLinkingCandidateId(candidate.id);
    try {
      const sourceName = getAccountName(
        candidate.outgoing.accountId,
      );
      const destinationName = getAccountName(
        candidate.incoming.accountId,
      );
      await linkTransactionsAsTransfer({
        outgoingTransactionId: candidate.outgoing.id,
        incomingTransactionId: candidate.incoming.id,
        description: `Transfer from ${sourceName} to ${destinationName}`,
        purpose: classification.value,
        envelopeId: classification.envelopeId,
        relatedEnvelopeId: classification.relatedEnvelopeId,
      });
      toast({
        title: "Entries linked as a transfer",
        description:
          "They now move account balances without counting as income or expense.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not link these entries",
        description:
          error instanceof Error
            ? error.message
            : "Refresh and try again.",
      });
    } finally {
      setLinkingCandidateId(null);
    }
  };

  const loading =
    accountsLoading ||
    transactionsLoading ||
    reconciliationsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-headline text-2xl font-bold tracking-tight sm:text-3xl">
            <WalletCards className="h-7 w-7" />
            Accounts
          </h1>
          <p className="mt-1 text-muted-foreground">
            Keep checking, savings, cards, and cash organized without
            double-counting transfers.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <PlaidLinkButton variant="outline" resumeOAuth />
          <Button
            variant="outline"
            onClick={() => setTransferOpen(true)}
            disabled={activeAccounts.length < 2}
            className="h-11 sm:h-10"
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transfer
          </Button>
          <Button
            onClick={() => {
              setEditingAccount(undefined);
              setAccountDialogOpen(true);
            }}
            className="h-11 sm:h-10"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add account
          </Button>
        </div>
      </div>

      <PlaidConnectionsCard />

      <div className="grid gap-4 sm:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total assets</CardDescription>
                <CardTitle>{currency.format(totals.assets)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total debt</CardDescription>
                <CardTitle>{currency.format(totals.debt)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Net worth</CardDescription>
                <CardTitle
                  className={
                    totals.netWorth < 0 ? "text-destructive" : ""
                  }
                >
                  {currency.format(totals.netWorth)}
                </CardTitle>
              </CardHeader>
            </Card>
          </>
        )}
      </div>

      {!loading && transferCandidates.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5" />
                  Potential transfers
                </CardTitle>
                <CardDescription className="mt-1">
                  Ledgerly found equal withdrawals and deposits in
                  different accounts within three days. Confirm only
                  pairs that are the same movement of money.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="w-fit">
                {transferCandidates.length} to review
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {transferCandidates.map((candidate) => {
              const sourceName = getAccountName(
                candidate.outgoing.accountId,
              );
              const destinationName = getAccountName(
                candidate.incoming.accountId,
              );
              const classificationOptions =
                transferClassificationOptions(
                  candidate,
                  primaryAccountId,
                  activeEnvelopes,
                );
              const selectedPurpose =
                transferPurposeByCandidate[candidate.id] ?? "ordinary";
              const selectedClassification =
                classificationOptions.find(
                  (option) => option.value === selectedPurpose,
                ) ?? classificationOptions[0];
              return (
                <div
                  key={candidate.id}
                  className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold tabular-nums">
                        {currency.format(candidate.amount)}
                      </p>
                      <Badge
                        variant={
                          candidate.confidence === "high"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {candidate.confidence === "high"
                          ? "Strong match"
                          : "Possible match"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm">
                      {sourceName}
                      <ArrowRightLeft className="mx-2 inline h-3.5 w-3.5 text-muted-foreground" />
                      {destinationName}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {format(
                        new Date(candidate.outgoing.date),
                        "MMM d, yyyy",
                      )}
                      {" · "}
                      {candidate.outgoing.description}
                      {" / "}
                      {candidate.incoming.description}
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-11 shrink-0 sm:h-10"
                        disabled={
                          linkingCandidateId === candidate.id
                        }
                      >
                        {linkingCandidateId === candidate.id
                          ? "Linking…"
                          : "Review and link"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Link these entries as one transfer?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          The {currency.format(candidate.amount)}{" "}
                          withdrawal from {sourceName} and deposit into{" "}
                          {destinationName} will become a linked
                          transfer. They will no longer count toward
                          income, expenses, budgets, or cash-flow
                          reports. Their account balances will remain
                          unchanged. Choose an envelope purpose below only
                          when this transfer assigned or moved planned money.
                        </AlertDialogDescription>
                        {classificationOptions.length > 1 ? (
                          <div className="space-y-2 pt-2 text-left">
                            <Label
                              htmlFor={`transfer-purpose-${candidate.id}`}
                            >
                              What did this transfer do?
                            </Label>
                            <Select
                              value={selectedClassification.value}
                              onValueChange={(value) =>
                                setTransferPurposeByCandidate((current) => ({
                                  ...current,
                                  [candidate.id]: value as TransferPurpose,
                                }))
                              }
                            >
                              <SelectTrigger
                                id={`transfer-purpose-${candidate.id}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {classificationOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : null}
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            void handleLinkTransfer(
                              candidate,
                              selectedClassification,
                            )
                          }
                        >
                          Link as transfer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {loading
          ? Array.from({ length: 2 }, (_, index) => (
              <Skeleton key={index} className="h-52" />
            ))
          : accounts.map((account) => {
              const signedBalance =
                accountBalances.get(account.id) ?? 0;
              const displayedBalance = displayAccountBalance(
                account,
                signedBalance,
              );
              const latestReconciliation =
                latestReconciliationByAccount.get(account.id);
              return (
                <Card
                  key={account.id}
                  className={account.isArchived ? "opacity-70" : ""}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="rounded-xl bg-secondary p-2.5 text-primary">
                          <AccountIcon type={account.type} />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-lg">
                            {account.name}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {ACCOUNT_TYPE_LABELS[account.type]}
                            {account.institution
                              ? ` · ${account.institution}`
                              : ""}
                            {account.lastFour
                              ? ` · •••• ${account.lastFour}`
                              : ""}
                          </CardDescription>
                        </div>
                      </div>
                      {account.isDefault ? (
                        <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium text-primary">
                          Primary
                        </span>
                      ) : account.isArchived ? (
                        <span className="rounded-full bg-muted px-2 py-1 text-xs">
                          Archived
                        </span>
                      ) : null}
                      {!account.isDefault && !account.isArchived && account.role ? (
                        <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                          {ACCOUNT_ROLE_LABELS[account.role]}
                        </span>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {account.classification === "liability"
                        ? signedBalance > 0
                          ? "Credit balance"
                          : "Current amount owed"
                        : "Current balance"}
                    </p>
                    <p className="mt-1 font-headline text-2xl font-semibold">
                      {currency.format(displayedBalance)}
                    </p>
                    {account.plaidAccountId ? (
                      <div className="mt-3 rounded-lg bg-secondary/50 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Institution available</span>
                          <span className="font-medium tabular-nums">
                            {account.institutionAvailableBalance == null
                              ? "Not reported"
                              : currency.format(account.institutionAvailableBalance)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Institution current</span>
                          <span className="font-medium tabular-nums">
                            {account.institutionCurrentBalance == null
                              ? "Not reported"
                              : currency.format(account.institutionCurrentBalance)}
                          </span>
                        </div>
                        {account.institutionBalanceUpdatedAt ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Bank balance checked {format(new Date(account.institutionBalanceUpdatedAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        ) : null}
                        {account.institutionCurrentBalance != null ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Bank minus Ledgerly: {currency.format(
                              account.institutionCurrentBalance - displayedBalance,
                            )}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {account.openingBalanceEstimated ? (
                      <p className="mt-3 flex items-start gap-2 text-xs text-amber-700">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Opening balance was estimated from imported history. Edit this account or reconcile a statement to confirm it.
                      </p>
                    ) : null}
                    {latestReconciliation ? (
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        {latestReconciliation.status ===
                        "reconciled" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                        <span
                          className={
                            latestReconciliation.status ===
                            "needs-review"
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }
                        >
                          {latestReconciliation.status ===
                          "reconciled"
                            ? `Reconciled through ${format(
                                new Date(
                                  `${latestReconciliation.statementDate}T12:00:00`,
                                ),
                                "MMM d, yyyy",
                              )}`
                            : "Latest statement check needs review"}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Not reconciled yet
                      </p>
                    )}
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href={`/accounts/${account.id}`}>
                          <Activity className="mr-2 h-4 w-4" />
                          View activity
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingAccount(account);
                          setAccountDialogOpen(true);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      {account.isArchived ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void restoreAccount(account.id)
                          }
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={account.isDefault}
                          onClick={() =>
                            void handleArchive(account)
                          }
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <AccountDialog
        account={editingAccount}
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
      />
      {transferOpen ? (
        <NewTransferSheet
          isOpen={transferOpen}
          onOpenChange={setTransferOpen}
          onTransferCreated={async (transfer) => {
            await addTransfer(transfer);
            toast({
              title: "Transfer created",
              description:
                "Account balances were updated without changing income or expenses.",
            });
          }}
        />
      ) : null}
    </div>
  );
}
