"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  Calendar as CalendarIcon,
  Check,
  CheckSquare2,
  Edit,
  FileDown,
  History,
  ListChecks,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccounts } from "@/hooks/use-accounts";
import { useEnvelopes } from "@/hooks/use-envelopes";
import { allocationsAreComplete } from "@/lib/transaction-allocations";
import { isTransactionReviewable } from "@/lib/categorization";
import {
  ALL_TRANSACTION_CATEGORIES,
  type TransactionCategoryOption,
} from "@/lib/transaction-category-filter";
import { canEditTransaction } from "@/lib/transaction-edit-policy";
import type { LedgerlyLayout } from "@/lib/ui-layout";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types";

export interface TransactionFiltersModel {
  description: string;
  category: string;
  dateRange?: DateRange;
  minAmount: string;
  maxAmount: string;
}

export interface TransactionsLayoutsProps {
  layout: LedgerlyLayout;
  allTransactions: Transaction[];
  filteredTransactions: Transaction[];
  paginatedTransactions: Transaction[];
  categories: Category[];
  categoryOptions: TransactionCategoryOption[];
  filters: TransactionFiltersModel;
  onDescriptionChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onDateRangeChange: (value: DateRange | undefined) => void;
  onMinAmountChange: (value: string) => void;
  onMaxAmountChange: (value: string) => void;
  onResetFilters: () => void;
  isFiltering: boolean;
  loading: boolean;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isMobile: boolean;
  activeYear: number;
  isReadOnly: boolean;
  reviewCount: number;
  onExport: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => void;
  activeTransactionId: string | null;
  onInspect: (transaction: Transaction) => void;
  selectedIds: Set<string>;
  onToggleSelected: (transactionId: string, selected: boolean) => void;
  onTogglePage: (selected: boolean) => void;
  inspectorCategoryId: string;
  onInspectorCategoryChange: (categoryId: string) => void;
  onSaveAndNext: () => Promise<void>;
  bulkCategoryId: string;
  onBulkCategoryChange: (categoryId: string) => void;
  onApplyBulkCategory: () => Promise<void>;
  bulkSaving: boolean;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function signedAmount(transaction: Transaction) {
  const incoming =
    transaction.type === "income" ||
    (transaction.type === "transfer" && transaction.transferDirection === "in");
  return `${incoming ? "+" : "-"}${currency.format(transaction.amount)}`;
}

function amountClass(transaction: Transaction) {
  if (transaction.type === "income") return "text-emerald-700";
  if (transaction.type === "transfer") return "text-primary";
  return "text-foreground";
}

function attentionLabel(transaction: Transaction) {
  if (isTransactionReviewable(transaction)) return "Needs category";
  if (
    transaction.allocations?.length &&
    !allocationsAreComplete(transaction.amount, transaction.allocations)
  ) {
    return "Incomplete split";
  }
  if (transaction.refundStatus === "exception") return "Refund review";
  if (transaction.recurringReconciliationStatus === "exception") {
    return "Recurring review";
  }
  if (transaction.postingStatus === "pending") return "Pending";
  if (transaction.postingStatus === "removed") return "Removed by bank";
  return null;
}

function categoryLabel(transaction: Transaction) {
  return transaction.allocations?.length
    ? `Split · ${transaction.allocations.length} categories`
    : transaction.category;
}

function eligibleCategoryOptions(
  options: TransactionCategoryOption[],
  transactions: Transaction[],
) {
  const types = new Set(
    transactions
      .filter((transaction) => transaction.type !== "transfer")
      .map((transaction) => transaction.type),
  );
  if (types.size !== 1) return [];
  const prefix = types.has("income") ? "Income · " : "Expense · ";
  return options.filter((option) => option.label.startsWith(prefix));
}

function TransactionBadges({ transaction }: { transaction: Transaction }) {
  const attention = attentionLabel(transaction);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="max-w-full truncate font-normal">
        {categoryLabel(transaction)}
      </Badge>
      {transaction.type === "transfer" ? (
        <Badge variant="secondary" className="gap-1 font-normal">
          <ArrowRightLeft className="h-3 w-3" />
          {transaction.transferDirection === "in" ? "Transfer in" : "Transfer out"}
        </Badge>
      ) : null}
      {attention ? (
        <Badge
          variant={
            attention === "Pending" || attention === "Removed by bank"
              ? "outline"
              : "destructive"
          }
          className="font-normal"
        >
          {attention}
        </Badge>
      ) : null}
      {transaction.categorizationSource === "rule" ? (
        <Badge variant="secondary" className="font-normal">Auto</Badge>
      ) : null}
    </div>
  );
}

function DeleteAction({
  transaction,
  disabled,
  onDelete,
  compact = false,
}: {
  transaction: Transaction;
  disabled: boolean;
  onDelete: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className="text-destructive hover:text-destructive"
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Delete ${transaction.description}`}
        >
          <Trash2 className="h-4 w-4" />
          {!compact ? <span className="ml-1.5">Delete</span> : null}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            {transaction.type === "transfer"
              ? "Both linked transfer entries will be permanently deleted."
              : `${transaction.description} will be permanently deleted.`}{" "}
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onDelete(transaction.id)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FilterToolbar(props: TransactionsLayoutsProps & { sticky?: boolean; disclosed?: boolean }) {
  return (
    <section
      aria-label="Transaction filters"
      className={cn(
        "border-y bg-card py-3",
        props.sticky && "sticky top-16 z-10 shadow-sm",
      )}
    >
      <div className="grid gap-2 px-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(13rem,1fr)_auto_minmax(10rem,.7fr)_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search transactions"
            placeholder="Search description"
            value={props.filters.description}
            onChange={(event) => props.onDescriptionChange(event.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <Select value={props.filters.category} onValueChange={props.onCategoryChange}>
          <SelectTrigger className="h-10" aria-label="Category filter">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TRANSACTION_CATEGORIES}>All categories</SelectItem>
            {props.categoryOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-10 justify-start whitespace-nowrap font-normal",
                !props.filters.dateRange && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {props.filters.dateRange?.from
                ? props.filters.dateRange.to
                  ? `${format(props.filters.dateRange.from, "MMM d")}–${format(props.filters.dateRange.to, "MMM d, y")}`
                  : format(props.filters.dateRange.from, "MMM d, y")
                : "Any date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={props.filters.dateRange?.from}
              selected={props.filters.dateRange}
              onSelect={props.onDateRangeChange}
              numberOfMonths={props.isMobile ? 1 : 2}
            />
          </PopoverContent>
        </Popover>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            aria-label="Minimum amount"
            placeholder="Min"
            value={props.filters.minAmount}
            onChange={(event) => props.onMinAmountChange(event.target.value)}
            className="h-10"
          />
          <Input
            type="number"
            aria-label="Maximum amount"
            placeholder="Max"
            value={props.filters.maxAmount}
            onChange={(event) => props.onMaxAmountChange(event.target.value)}
            className="h-10"
          />
        </div>
        <Button
          variant="ghost"
          className="h-10"
          disabled={!props.isFiltering}
          onClick={props.onResetFilters}
        >
          <X className="mr-1.5 h-4 w-4" /> Reset
        </Button>
      </div>
    </section>
  );
}

function ListHeader(props: TransactionsLayoutsProps & { compact?: boolean }) {
  const start =
    props.filteredTransactions.length > 0
      ? (props.page - 1) * props.pageSize + 1
      : 0;
  const end = Math.min(
    props.page * props.pageSize,
    props.filteredTransactions.length,
  );
  return (
    <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className={cn("font-semibold", props.compact ? "text-lg" : "text-xl")}>
          Transactions
        </h2>
        <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
          {props.isFiltering
            ? `${props.filteredTransactions.length} matching transactions`
            : `${start}–${end} of ${props.allTransactions.length} transactions`}
        </p>
      </div>
      <div className="flex flex-col gap-2 min-[430px]:flex-row">
        <Button variant="outline" size="sm" asChild>
          <Link href="/transactions/review">
            <ListChecks className="mr-2 h-4 w-4" />
            Needs categorization{props.reviewCount ? ` (${props.reviewCount})` : ""}
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={props.allTransactions.length === 0}
          onClick={props.onExport}
        >
          <FileDown className="mr-2 h-4 w-4" /> Export
        </Button>
      </div>
    </div>
  );
}

function MobileTransactionRows(props: TransactionsLayoutsProps & { attentionFirst?: boolean }) {
  const { getAccountName } = useAccounts();
  const source = props.attentionFirst
    ? [...props.paginatedTransactions].sort(
        (left, right) =>
          Number(Boolean(attentionLabel(right))) -
          Number(Boolean(attentionLabel(left))),
      )
    : props.paginatedTransactions;
  const groups = source.reduce<Array<{ date: string; rows: Transaction[] }>>(
    (result, transaction) => {
      const date = format(new Date(transaction.date), "EEEE, MMMM d");
      const current = result.at(-1);
      if (current?.date === date) current.rows.push(transaction);
      else result.push({ date, rows: [transaction] });
      return result;
    },
    [],
  );

  if (props.loading && props.allTransactions.length === 0) {
    return <div className="flex h-28 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (source.length === 0) {
    return <p className="border border-dashed p-8 text-center text-sm text-muted-foreground">No transactions found.</p>;
  }
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.date} aria-label={group.date}>
          <h3 className="sticky top-16 z-[1] border-b bg-background/95 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.date}
          </h3>
          <div className="divide-y">
            {group.rows.map((transaction) => (
              <button
                key={transaction.id}
                type="button"
                data-transaction-id={transaction.id}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => props.onEdit(transaction)}
                disabled={!canEditTransaction(transaction)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{transaction.description}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {getAccountName(transaction.accountId)} · {categoryLabel(transaction)}
                  </span>
                  {attentionLabel(transaction) ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5" /> {attentionLabel(transaction)}
                    </span>
                  ) : null}
                </span>
                <span className={cn("whitespace-nowrap text-right font-code font-medium tabular-nums", amountClass(transaction))}>
                  {signedAmount(transaction)}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SharedPagination(props: TransactionsLayoutsProps) {
  return props.totalPages > 1 ? (
    <div className="mt-5 overflow-x-auto border-t pt-4">
      <Pagination
        currentPage={props.page}
        totalPages={props.totalPages}
        onPageChange={props.onPageChange}
        pageNeighbours={props.isMobile ? 0 : 1}
      />
    </div>
  ) : null;
}

function ClarifiedTransactions(props: TransactionsLayoutsProps) {
  const { getAccountName } = useAccounts();
  return (
    <div className="space-y-5" data-layout="clarified">
      <FilterToolbar {...props} />
      <ListHeader {...props} />
      <div className="md:hidden"><MobileTransactionRows {...props} /></div>
      <div className="hidden overflow-x-auto md:block">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="border-y hover:bg-transparent">
              <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Category / attention</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.loading && props.allTransactions.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-28 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
            ) : props.paginatedTransactions.length > 0 ? props.paginatedTransactions.map((transaction) => (
              <TableRow
                key={transaction.id}
                data-transaction-id={transaction.id}
                className={cn("h-14", canEditTransaction(transaction) && "cursor-pointer")}
                onClick={() => props.onEdit(transaction)}
              >
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(transaction.date), "MMM d, yyyy")}</TableCell>
                <TableCell className="max-w-60 truncate font-medium">{transaction.description}</TableCell>
                <TableCell><TransactionBadges transaction={transaction} /></TableCell>
                <TableCell className="max-w-40 truncate text-muted-foreground">{getAccountName(transaction.accountId)}</TableCell>
                <TableCell className={cn("whitespace-nowrap text-right font-code font-medium tabular-nums", amountClass(transaction))}>{signedAmount(transaction)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); props.onEdit(transaction); }} disabled={!canEditTransaction(transaction)} aria-label={`Edit ${transaction.description}`}><Edit className="h-4 w-4" /></Button>
                    <DeleteAction transaction={transaction} disabled={props.isReadOnly} onDelete={props.onDelete} compact />
                  </div>
                </TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No transactions found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <SharedPagination {...props} />
    </div>
  );
}

function DeskInspector(props: TransactionsLayoutsProps) {
  const { getAccountName } = useAccounts();
  const { getEnvelopeName } = useEnvelopes();
  const transaction = props.filteredTransactions.find(
    (item) => item.id === props.activeTransactionId,
  );
  const options = transaction
    ? eligibleCategoryOptions(props.categoryOptions, [transaction])
    : [];
  if (!transaction) {
    return (
      <aside className="hidden border-l pl-5 lg:block">
        <div className="sticky top-36 border border-dashed p-6 text-center text-sm text-muted-foreground">
          Select a row to inspect it without leaving the ledger.
        </div>
      </aside>
    );
  }
  return (
    <aside className="hidden border-l pl-5 lg:block" aria-label="Transaction inspector">
      <div className="sticky top-36 space-y-5" data-testid="transaction-inspector">
        <div className="border-b pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Inspector</p>
          <h2 className="mt-1 truncate text-lg font-semibold">{transaction.description}</h2>
          <p className={cn("mt-2 text-right font-code text-2xl font-semibold tabular-nums", amountClass(transaction))}>{signedAmount(transaction)}</p>
        </div>
        {transaction.type !== "transfer" && !transaction.allocations?.length ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="desk-inspector-category">Category</label>
            <Select value={props.inspectorCategoryId} onValueChange={props.onInspectorCategoryChange}>
              <SelectTrigger id="desk-inspector-category"><SelectValue placeholder="Choose category" /></SelectTrigger>
              <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label.replace(/^(Income|Expense) · /, "")}</SelectItem>)}</SelectContent>
            </Select>
            <Button className="w-full" disabled={!props.inspectorCategoryId || props.bulkSaving || !canEditTransaction(transaction)} onClick={() => void props.onSaveAndNext()}>
              {props.bulkSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Save and next
            </Button>
          </div>
        ) : (
          <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>{transaction.type === "transfer" ? "Linked transfer" : "Split transaction"}</AlertTitle><AlertDescription>Use the full editor to change this transaction safely.</AlertDescription></Alert>
        )}
        <dl className="divide-y text-sm">
          <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Date</dt><dd>{format(new Date(transaction.date), "MMM d, yyyy")}</dd></div>
          <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Account</dt><dd className="text-right">{getAccountName(transaction.accountId)}</dd></div>
          <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Category</dt><dd className="text-right">{categoryLabel(transaction)}</dd></div>
          {transaction.envelopeId ? <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Envelope</dt><dd className="text-right">{getEnvelopeName(transaction.envelopeId)}</dd></div> : null}
          <div className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">Status</dt><dd className="text-right capitalize">{transaction.postingStatus ?? "posted"}</dd></div>
        </dl>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => props.onEdit(transaction)} disabled={!canEditTransaction(transaction)}><Edit className="mr-2 h-4 w-4" /> Edit</Button>
          <DeleteAction transaction={transaction} disabled={props.isReadOnly} onDelete={props.onDelete} />
        </div>
      </div>
    </aside>
  );
}

function DeskTransactions(props: TransactionsLayoutsProps) {
  const { getAccountName } = useAccounts();
  const selectedTransactions = props.filteredTransactions.filter((transaction) => props.selectedIds.has(transaction.id));
  const bulkOptions = eligibleCategoryOptions(props.categoryOptions, selectedTransactions);
  const selectablePage = props.paginatedTransactions.filter((transaction) => transaction.type !== "transfer" && !transaction.allocations?.length && canEditTransaction(transaction));
  const allPageSelected = selectablePage.length > 0 && selectablePage.every((transaction) => props.selectedIds.has(transaction.id));

  return (
    <div className="space-y-4" data-layout="bookkeepers-desk">
      <FilterToolbar {...props} sticky />
      {props.selectedIds.size > 0 ? (
        <div className="flex flex-col gap-3 border-y bg-secondary/25 px-3 py-3 sm:flex-row sm:items-center">
          <p className="shrink-0 text-sm font-medium">{props.selectedIds.size} selected</p>
          <Select value={props.bulkCategoryId} onValueChange={props.onBulkCategoryChange}>
            <SelectTrigger className="h-9 min-w-60 bg-card"><SelectValue placeholder={bulkOptions.length ? "Assign category" : "Select one transaction type"} /></SelectTrigger>
            <SelectContent>{bulkOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" disabled={!props.bulkCategoryId || props.bulkSaving || bulkOptions.length === 0} onClick={() => void props.onApplyBulkCategory()}>
            {props.bulkSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare2 className="mr-2 h-4 w-4" />} Apply category
          </Button>
        </div>
      ) : null}
      <ListHeader {...props} compact />
      <div className="lg:hidden"><MobileTransactionRows {...props} attentionFirst /></div>
      <div className="hidden min-w-0 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="max-h-[calc(100dvh-17rem)] overflow-auto border-y">
          <Table className="min-w-[600px] text-xs">
            <TableHeader className="sticky top-0 z-[1] bg-card">
              <TableRow className="h-9 hover:bg-card">
                <TableHead className="w-9 px-2"><Checkbox aria-label="Select this page" checked={allPageSelected} onCheckedChange={(checked) => props.onTogglePage(Boolean(checked))} /></TableHead>
                <TableHead className="w-24 px-2">Date</TableHead><TableHead className="px-2">Description</TableHead><TableHead className="px-2">Category</TableHead><TableHead className="px-2">Account</TableHead><TableHead className="px-2 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.paginatedTransactions.map((transaction, index) => {
                const selectable = transaction.type !== "transfer" && !transaction.allocations?.length && canEditTransaction(transaction);
                return (
                  <TableRow
                    key={transaction.id}
                    data-transaction-id={transaction.id}
                    data-selected={props.activeTransactionId === transaction.id ? "true" : undefined}
                    tabIndex={0}
                    className={cn("h-9 cursor-pointer", props.activeTransactionId === transaction.id && "bg-secondary/45")}
                    onClick={() => props.onInspect(transaction)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") props.onEdit(transaction);
                      if (event.key === "ArrowDown") { event.preventDefault(); props.onInspect(props.paginatedTransactions[Math.min(index + 1, props.paginatedTransactions.length - 1)]); (event.currentTarget.nextElementSibling as HTMLElement | null)?.focus(); }
                      if (event.key === "ArrowUp") { event.preventDefault(); props.onInspect(props.paginatedTransactions[Math.max(index - 1, 0)]); (event.currentTarget.previousElementSibling as HTMLElement | null)?.focus(); }
                    }}
                  >
                    <TableCell className="px-2" onClick={(event) => event.stopPropagation()}><Checkbox aria-label={`Select ${transaction.description}`} disabled={!selectable} checked={props.selectedIds.has(transaction.id)} onCheckedChange={(checked) => props.onToggleSelected(transaction.id, Boolean(checked))} /></TableCell>
                    <TableCell className="whitespace-nowrap px-2 text-muted-foreground">{format(new Date(transaction.date), "MMM d")}</TableCell>
                    <TableCell className="max-w-40 truncate px-2 font-medium">{transaction.description}</TableCell>
                    <TableCell className="max-w-36 truncate px-2"><span className={cn(attentionLabel(transaction) && "font-medium text-amber-700")}>{attentionLabel(transaction) ?? categoryLabel(transaction)}</span></TableCell>
                    <TableCell className="max-w-28 truncate px-2 text-muted-foreground">{getAccountName(transaction.accountId)}</TableCell>
                    <TableCell className={cn("whitespace-nowrap px-2 text-right font-code font-medium tabular-nums", amountClass(transaction))}>{signedAmount(transaction)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <DeskInspector {...props} />
      </div>
      <SharedPagination {...props} />
    </div>
  );
}

function FinancialBriefTransactions(props: TransactionsLayoutsProps) {
  const { getAccountName } = useAccounts();
  const groups = useMemo(() => {
    const result = new Map<string, Transaction[]>();
    for (const transaction of props.paginatedTransactions) {
      const key = format(new Date(transaction.date), "yyyy-MM-dd");
      result.set(key, [...(result.get(key) ?? []), transaction]);
    }
    return [...result.entries()];
  }, [props.paginatedTransactions]);

  return (
    <div className="mx-auto max-w-6xl space-y-6" data-layout="financial-brief">
      <FilterToolbar {...props} />
      <ListHeader {...props} />
      {groups.length === 0 ? <p className="border border-dashed p-10 text-center text-sm text-muted-foreground">No transactions found.</p> : (
        <div className="space-y-7">
          {groups.map(([date, rows]) => (
            <section key={date} aria-labelledby={`audit-${date}`}>
              <div className="flex items-baseline justify-between border-b pb-2">
                <h3 id={`audit-${date}`} className="font-headline font-semibold">{format(new Date(`${date}T12:00:00`), "EEEE, MMMM d")}</h3>
                <p className="text-xs text-muted-foreground">{rows.length} entr{rows.length === 1 ? "y" : "ies"}</p>
              </div>
              <div className="divide-y">
                {rows.map((transaction) => (
                  <div key={transaction.id} data-transaction-id={transaction.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,.45fr)_auto_auto]">
                    <button type="button" className="min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => props.onEdit(transaction)} disabled={!canEditTransaction(transaction)}>
                      <span className="block truncate font-medium">{transaction.description}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">{getAccountName(transaction.accountId)}</span>
                    </button>
                    <div className="hidden sm:block"><TransactionBadges transaction={transaction} /></div>
                    <p className={cn("whitespace-nowrap text-right font-code font-semibold tabular-nums", amountClass(transaction))}>{signedAmount(transaction)}</p>
                    <Button variant="ghost" size="icon" onClick={() => props.onEdit(transaction)} disabled={!canEditTransaction(transaction)} aria-label={`Open ${transaction.description}`}><ArrowRight className="h-4 w-4" /></Button>
                    <div className="col-span-2 sm:hidden"><TransactionBadges transaction={transaction} /></div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <SharedPagination {...props} />
    </div>
  );
}

export function TransactionsLayouts(props: TransactionsLayoutsProps) {
  return (
    <>
      {props.isReadOnly ? (
        <Alert>
          <History className="h-4 w-4" />
          <AlertTitle>Correcting historical transactions</AlertTitle>
          <AlertDescription>
            You can edit {props.activeYear} income and expenses. Adding,
            importing, deleting, and transfers remain unavailable in a past year.
          </AlertDescription>
        </Alert>
      ) : null}
      {props.layout === "bookkeepers-desk" ? <DeskTransactions {...props} /> : props.layout === "financial-brief" ? <FinancialBriefTransactions {...props} /> : <ClarifiedTransactions {...props} />}
    </>
  );
}
