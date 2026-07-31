"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  endOfYear,
  format,
  startOfYear,
} from "date-fns";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  CheckCircle2,
  FileCheck2,
  Search,
  Scale,
  WalletCards,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAccountReconciliations } from "@/hooks/use-account-reconciliations";
import { useAccounts } from "@/hooks/use-accounts";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useAllTransactions } from "@/hooks/use-transactions";
import {
  ACCOUNT_TYPE_LABELS,
  buildAccountBalanceTimeline,
  buildAccountLedger,
  calculateAccountBalanceAsOf,
  ledgerBalanceToStatementBalance,
  statementBalanceToLedgerBalance,
  type AccountLedgerEntry,
} from "@/lib/accounts";
import { cn } from "@/lib/utils";
import type {
  Account,
  AccountReconciliation,
  Transaction,
} from "@/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const LEDGER_PAGE_SIZE = 30;

const AccountBalanceChart = dynamic(
  () =>
    import(
      "@/components/accounts/account-balance-chart"
    ).then((module) => module.AccountBalanceChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-72 w-full" />,
  },
);

function displayLedgerBalance(
  account: Account,
  balance: number,
): number {
  return ledgerBalanceToStatementBalance(account, balance);
}

function transactionSign(transaction: Transaction) {
  if (transaction.type === "income") return "+";
  if (transaction.type === "expense") return "-";
  return transaction.transferDirection === "in" ? "+" : "-";
}

function transactionTone(transaction: Transaction) {
  if (transaction.type === "income") return "text-emerald-600";
  if (transaction.type === "expense") return "text-foreground";
  return "text-primary";
}

function ReconciliationDialog({
  account,
  transactions,
  activeYear,
  open,
  onOpenChange,
  onSave,
}: {
  account: Account;
  transactions: Transaction[];
  activeYear: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    values: Omit<
      AccountReconciliation,
      "id" | "createdAt"
    >,
  ) => Promise<AccountReconciliation>;
}) {
  const { toast } = useToast();
  const [statementDate, setStatementDate] = useState("");
  const [statementBalance, setStatementBalance] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = new Date();
    const defaultDate =
      activeYear === today.getFullYear()
        ? today
        : endOfYear(new Date(activeYear, 0, 1));
    const dateKey = format(defaultDate, "yyyy-MM-dd");
    const ledgerBalance = calculateAccountBalanceAsOf(
      account,
      transactions,
      dateKey,
    );
    setStatementDate(dateKey);
    setStatementBalance(
      displayLedgerBalance(account, ledgerBalance).toFixed(2),
    );
    setNote("");
  }, [account, activeYear, open, transactions]);

  const numericStatementBalance = Number(statementBalance);
  const validBalance =
    statementBalance.trim() !== "" &&
    Number.isFinite(numericStatementBalance);
  const ledgerBalance = statementDate
    ? calculateAccountBalanceAsOf(
        account,
        transactions,
        statementDate,
      )
    : account.openingBalance;
  const internalStatementBalance = validBalance
    ? statementBalanceToLedgerBalance(
        account,
        numericStatementBalance,
      )
    : 0;
  const difference = validBalance
    ? internalStatementBalance - ledgerBalance
    : 0;
  const displayedDifference = validBalance
    ? numericStatementBalance -
      displayLedgerBalance(account, ledgerBalance)
    : 0;
  const balanced =
    validBalance && Math.abs(difference) < 0.01;

  const save = async () => {
    if (!statementDate || !validBalance) return;
    setSaving(true);
    try {
      const statementCutoff = new Date(
        `${statementDate}T23:59:59.999`,
      ).getTime();
      const transactionCount = transactions.filter(
        (transaction) =>
          (transaction.accountId === account.id ||
            (!transaction.accountId && account.isDefault)) &&
          new Date(transaction.date).getTime() <= statementCutoff,
      ).length;
      await onSave({
        accountId: account.id,
        statementDate,
        statementBalance: internalStatementBalance,
        ledgerBalance,
        difference,
        transactionCount,
        status: balanced ? "reconciled" : "needs-review",
        note: note.trim() || undefined,
      });
      toast({
        title: balanced
          ? "Account reconciled"
          : "Reconciliation check saved",
        description: balanced
          ? `Ledgerly matches the ${format(
              new Date(`${statementDate}T12:00:00`),
              "MMM d, yyyy",
            )} statement.`
          : "The difference is saved so you can review missing or duplicated entries.",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not save the reconciliation",
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Reconcile {account.name}</DialogTitle>
          <DialogDescription>
            Compare the balance on a bank statement with Ledgerly as
            of the same date. This check never creates or changes a
            transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="statement-date">Statement date</Label>
              <Input
                id="statement-date"
                type="date"
                value={statementDate}
                onChange={(event) =>
                  setStatementDate(event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="statement-balance">
                {account.classification === "liability"
                  ? "Statement amount owed"
                  : "Statement ending balance"}
              </Label>
              <Input
                id="statement-balance"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={statementBalance}
                onChange={(event) =>
                  setStatementBalance(event.target.value)
                }
              />
              {account.classification === "liability" ? (
                <p className="text-xs text-muted-foreground">
                  Use a negative number if the card has a credit.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border bg-muted/35 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Ledgerly
              </p>
              <p className="mt-1 font-semibold tabular-nums">
                {currency.format(
                  displayLedgerBalance(account, ledgerBalance),
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Statement
              </p>
              <p className="mt-1 font-semibold tabular-nums">
                {validBalance
                  ? currency.format(numericStatementBalance)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Difference
              </p>
              <p
                className={cn(
                  "mt-1 font-semibold tabular-nums",
                  validBalance &&
                    !balanced &&
                    "text-destructive",
                )}
              >
                {validBalance
                  ? currency.format(displayedDifference)
                  : "—"}
              </p>
            </div>
          </div>

          {validBalance ? (
            <Alert variant={balanced ? "default" : "destructive"}>
              {balanced ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertTitle>
                {balanced
                  ? "Balances match"
                  : "Review needed"}
              </AlertTitle>
              <AlertDescription>
                {balanced
                  ? "This statement can be marked reconciled."
                  : "Check for missing entries, duplicates, incorrect amounts, or the wrong posting date. Ledgerly will save this difference without altering your books."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="reconciliation-note">
              Note (optional)
            </Label>
            <Textarea
              id="reconciliation-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. July bank statement"
              rows={3}
            />
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
          <Button
            type="button"
            onClick={() => void save()}
            disabled={
              saving || !statementDate || !validBalance
            }
          >
            {saving
              ? "Saving…"
              : balanced
                ? "Mark reconciled"
                : "Save for review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LedgerCard({
  account,
  entries,
}: {
  account: Account;
  entries: AccountLedgerEntry[];
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [visibleCount, setVisibleCount] =
    useState(LEDGER_PAGE_SIZE);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return entries.filter(({ transaction }) => {
      if (type !== "all" && transaction.type !== type) return false;
      if (!query) return true;
      return (
        transaction.description
          .toLocaleLowerCase()
          .includes(query) ||
        transaction.category.toLocaleLowerCase().includes(query)
      );
    });
  }, [entries, search, type]);

  useEffect(() => {
    setVisibleCount(LEDGER_PAGE_SIZE);
  }, [search, type]);

  const visibleEntries = filteredEntries.slice(0, visibleCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account ledger</CardTitle>
        <CardDescription>
          Every entry in {account.name}, with the balance immediately
          after it posted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_13rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search description or category"
              className="pl-9"
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label="Filter ledger by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entry types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
              <SelectItem value="transfer">Transfers</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 md:hidden">
          {visibleEntries.length > 0 ? (
            visibleEntries.map(({ transaction, runningBalance }) => (
              <article
                key={transaction.id}
                className="rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {transaction.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {transaction.category}
                      </Badge>
                      {transaction.type === "transfer" ? (
                        <Badge variant="secondary">
                          {transaction.transferDirection === "in"
                            ? "Transfer in"
                            : "Transfer out"}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 font-mono font-semibold",
                      transactionTone(transaction),
                    )}
                  >
                    {transactionSign(transaction)}
                    {currency.format(Math.abs(transaction.amount))}
                  </p>
                </div>
                <div className="mt-3 flex justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>
                    {format(new Date(transaction.date), "MMM d, yyyy")}
                  </span>
                  <span className="tabular-nums">
                    Balance{" "}
                    {currency.format(
                      displayLedgerBalance(
                        account,
                        runningBalance,
                      ),
                    )}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No ledger entries match these filters.
            </p>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">
                  Balance
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEntries.length > 0 ? (
                visibleEntries.map(
                  ({ transaction, runningBalance }) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(
                          new Date(transaction.date),
                          "MMM d, yyyy",
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-medium">
                        {transaction.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {transaction.category}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right font-mono",
                          transactionTone(transaction),
                        )}
                      >
                        {transactionSign(transaction)}
                        {currency.format(
                          Math.abs(transaction.amount),
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono">
                        {currency.format(
                          displayLedgerBalance(
                            account,
                            runningBalance,
                          ),
                        )}
                      </TableCell>
                    </TableRow>
                  ),
                )
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center"
                  >
                    No ledger entries match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {visibleCount < filteredEntries.length ? (
          <div className="mt-5 flex justify-center">
            <Button
              variant="outline"
              onClick={() =>
                setVisibleCount(
                  (current) => current + LEDGER_PAGE_SIZE,
                )
              }
            >
              Show more entries
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function AccountDetailPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const {
    accounts,
    loading: accountsLoading,
  } = useAccounts();
  const { activeYear } = useAuth();
  const {
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
  } = useAllTransactions({ respectAccountFilter: false });
  const {
    reconciliations,
    loading: reconciliationsLoading,
    error: reconciliationsError,
    saveReconciliation,
  } = useAccountReconciliations(accountId);
  const [reconciliationOpen, setReconciliationOpen] =
    useState(false);
  const account = accounts.find(
    (candidate) => candidate.id === accountId,
  );

  const period = useMemo(() => {
    const start = startOfYear(new Date(activeYear, 0, 1));
    const fullEnd = endOfYear(start);
    const now = new Date();
    const end =
      activeYear === now.getFullYear() ? now : fullEnd;
    return { start, end };
  }, [activeYear]);

  const accountLedger = useMemo(
    () => (account ? buildAccountLedger(account, transactions) : []),
    [account, transactions],
  );
  const periodLedger = useMemo(
    () =>
      accountLedger.filter(({ transaction }) => {
        const time = new Date(transaction.date).getTime();
        return (
          time >= period.start.getTime() &&
          time <= period.end.getTime()
        );
      }),
    [accountLedger, period],
  );

  const metrics = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let transfersIn = 0;
    let transfersOut = 0;
    for (const { transaction } of periodLedger) {
      const amount = Math.abs(transaction.amount);
      if (transaction.type === "income") income += amount;
      else if (transaction.type === "expense") expenses += amount;
      else if (transaction.transferDirection === "in") {
        transfersIn += amount;
      } else {
        transfersOut += amount;
      }
    }
    return { income, expenses, transfersIn, transfersOut };
  }, [periodLedger]);

  const chartData = useMemo(() => {
    if (!account) return [];
    return buildAccountBalanceTimeline(
      account,
      transactions,
      period.start,
      period.end,
    ).map((point) => ({
      ...point,
      balance: displayLedgerBalance(account, point.balance),
      label: format(
        new Date(`${point.date}T12:00:00`),
        "MMM d",
      ),
    }));
  }, [account, period, transactions]);

  if (
    accountsLoading ||
    transactionsLoading ||
    reconciliationsLoading
  ) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!account) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Account not found</CardTitle>
          <CardDescription>
            This account may have been removed or is not available to
            the signed-in user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/accounts">Return to accounts</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentBalance = calculateAccountBalanceAsOf(
    account,
    transactions,
    period.end,
  );
  const latestReconciliation = reconciliations[0];
  const pageError = transactionsError ?? reconciliationsError;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href="/accounts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            All accounts
          </Link>
        </Button>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-headline text-2xl font-bold tracking-tight sm:text-3xl">
                {account.name}
              </h1>
              {account.isArchived ? (
                <Badge variant="secondary">Archived</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-muted-foreground">
              {ACCOUNT_TYPE_LABELS[account.type]}
              {account.institution
                ? ` · ${account.institution}`
                : ""}
              {account.lastFour
                ? ` · •••• ${account.lastFour}`
                : ""}
              {` · ${activeYear} activity`}
            </p>
          </div>
          <Button
            onClick={() => setReconciliationOpen(true)}
            className="h-11 sm:h-10"
          >
            <Scale className="mr-2 h-4 w-4" />
            Reconcile statement
          </Button>
        </div>
      </div>

      {pageError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Some account data could not load</AlertTitle>
          <AlertDescription>
            Refresh the page before relying on these balances.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {account.classification === "liability"
                ? "Amount owed"
                : "Balance"}
            </CardDescription>
            <CardTitle className="tabular-nums">
              {currency.format(
                displayLedgerBalance(account, currentBalance),
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Through {format(period.end, "MMM d, yyyy")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
              Income
            </CardDescription>
            <CardTitle className="tabular-nums">
              {currency.format(metrics.income)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Transfers excluded
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ArrowUpRight className="h-4 w-4 text-destructive" />
              Expenses
            </CardDescription>
            <CardTitle className="tabular-nums">
              {currency.format(metrics.expenses)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Transfers excluded
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Net transfers
            </CardDescription>
            <CardTitle className="tabular-nums">
              {currency.format(
                metrics.transfersIn - metrics.transfersOut,
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {currency.format(metrics.transfersIn)} in ·{" "}
            {currency.format(metrics.transfersOut)} out
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>
            {account.classification === "liability"
              ? "Amount owed history"
              : "Balance history"}
          </CardTitle>
          <CardDescription>
            Running balance during {activeYear}. Income and expenses
            affect cash flow; transfers affect only account balances.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
          {chartData.length > 1 ? (
            <AccountBalanceChart
              data={chartData}
              accountName={account.name}
              activeYear={activeYear}
              isLiability={
                account.classification === "liability"
              }
            />
          ) : (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed text-center">
              <WalletCards className="mb-2 h-7 w-7 text-muted-foreground" />
              <p className="font-medium">
                No balance activity in {activeYear}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add or import an entry for this account to begin its
                chart.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5" />
              Reconciliation history
            </CardTitle>
            <CardDescription className="mt-1">
              Saved statement checks provide an audit trail; they do
              not change transaction totals.
            </CardDescription>
          </div>
          {latestReconciliation ? (
            <Badge
              variant={
                latestReconciliation.status === "reconciled"
                  ? "secondary"
                  : "destructive"
              }
              className="w-fit"
            >
              {latestReconciliation.status === "reconciled" ? (
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              )}
              {latestReconciliation.status === "reconciled"
                ? "Latest check balanced"
                : "Latest check needs review"}
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          {reconciliations.length > 0 ? (
            <div className="divide-y rounded-xl border">
              {reconciliations.slice(0, 8).map((reconciliation) => (
                <div
                  key={reconciliation.id}
                  className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                >
                  <div>
                    <p className="font-medium">
                      {format(
                        new Date(
                          `${reconciliation.statementDate}T12:00:00`,
                        ),
                        "MMMM d, yyyy",
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {reconciliation.note ||
                        `${reconciliation.transactionCount} entries included`}
                    </p>
                  </div>
                  <div className="text-sm sm:text-right">
                    <p className="text-muted-foreground">
                      Statement
                    </p>
                    <p className="font-mono font-medium">
                      {currency.format(
                        displayLedgerBalance(
                          account,
                          reconciliation.statementBalance,
                        ),
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={
                      reconciliation.status === "reconciled"
                        ? "secondary"
                        : "destructive"
                    }
                    className="w-fit sm:ml-3"
                  >
                    {reconciliation.status === "reconciled"
                      ? "Reconciled"
                      : `${currency.format(
                          Math.abs(reconciliation.difference),
                        )} difference`}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <Scale className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-3 font-medium">
                No statement checks yet
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Reconcile after each statement closes to catch
                missing, duplicated, or incorrectly dated entries.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setReconciliationOpen(true)}
              >
                Reconcile first statement
              </Button>
            </div>
          )}

          {latestReconciliation?.status === "needs-review" ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                The latest statement does not match
              </AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  Review this ledger for missing entries, duplicates,
                  amount errors, and posting dates. Correct the entries,
                  then run the reconciliation again.
                </p>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/transactions">
                    Review all transactions
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <LedgerCard account={account} entries={periodLedger} />

      <ReconciliationDialog
        account={account}
        transactions={transactions}
        activeYear={activeYear}
        open={reconciliationOpen}
        onOpenChange={setReconciliationOpen}
        onSave={saveReconciliation}
      />
    </div>
  );
}
