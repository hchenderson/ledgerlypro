"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { TransactionsLayouts } from "@/components/layouts/transactions-layouts";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewSwitcher } from "@/components/view-switcher";
import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { useTransactionData } from "@/hooks/use-transactions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { isTransactionReviewable } from "@/lib/categorization";
import { findCategoryWithPathById } from "@/lib/category-tree";
import { calendarDateToLedgerDate } from "@/lib/ledger-date";
import {
  ALL_TRANSACTION_CATEGORIES,
  TRANSFER_TRANSACTION_CATEGORY,
  buildTransactionCategoryOptions,
  filterTransactionsByCategory,
} from "@/lib/transaction-category-filter";
import {
  canEditTransaction,
  historicalTransactionYear,
} from "@/lib/transaction-edit-policy";
import type { Transaction } from "@/types";

const NewTransactionSheet = dynamic(
  () =>
    import("@/components/new-transaction-sheet").then(
      (module) => module.NewTransactionSheet,
    ),
  { ssr: false },
);

const ExportTransactionsDialog = dynamic(
  () =>
    import("@/components/export-transactions-dialog").then(
      (module) => module.ExportTransactionsDialog,
    ),
  { ssr: false },
);

const TRANSACTIONS_PAGE_SIZE = 25;

function TransactionsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading transactions">
      <div className="flex items-end justify-between border-b pb-5">
        <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72" /></div>
        <Skeleton className="h-10 w-72" />
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-[32rem] w-full" />
    </div>
  );
}

export function ProductionTransactionsPage() {
  const {
    transactions: allTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    loading: userDataLoading,
  } = useTransactionData();
  const { categories = [] } = useCategories();
  const { activeYear, uiLayout } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [page, setPage] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [activeTransactionId, setActiveTransactionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectorCategoryId, setInspectorCategoryId] = useState("");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const [descriptionFilter, setDescriptionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_TRANSACTION_CATEGORIES);
  const [dateRange, setDateRange] = useState<DateRange>();
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const systemYear = new Date().getFullYear();
  const isReadOnly = activeYear < systemYear;

  const filteredTransactions = useMemo(() => {
    let transactions = [...allTransactions];
    if (descriptionFilter) {
      const query = descriptionFilter.toLocaleLowerCase();
      transactions = transactions.filter((transaction) =>
        transaction.description.toLocaleLowerCase().includes(query),
      );
    }
    transactions = filterTransactionsByCategory(transactions, categoryFilter, categories);
    if (dateRange?.from) {
      transactions = transactions.filter((transaction) => new Date(transaction.date) >= dateRange.from!);
    }
    if (dateRange?.to) {
      const end = new Date(dateRange.to);
      end.setHours(23, 59, 59, 999);
      transactions = transactions.filter((transaction) => new Date(transaction.date) <= end);
    }
    const minimum = minAmount ? Number.parseFloat(minAmount) : -Infinity;
    const maximum = maxAmount ? Number.parseFloat(maxAmount) : Infinity;
    if (minAmount || maxAmount) {
      transactions = transactions.filter((transaction) => transaction.amount >= minimum && transaction.amount <= maximum);
    }
    return transactions;
  }, [allTransactions, categories, categoryFilter, dateRange, descriptionFilter, maxAmount, minAmount]);

  useEffect(() => setPage(1), [categoryFilter, dateRange, descriptionFilter, maxAmount, minAmount]);

  const totalPages = Math.ceil(filteredTransactions.length / TRANSACTIONS_PAGE_SIZE);
  useEffect(() => {
    setPage((current) => Math.max(1, Math.min(current, Math.max(1, totalPages))));
  }, [totalPages]);

  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * TRANSACTIONS_PAGE_SIZE;
    return filteredTransactions.slice(start, start + TRANSACTIONS_PAGE_SIZE);
  }, [filteredTransactions, page]);

  const categoryOptions = useMemo(() => {
    const options = buildTransactionCategoryOptions(categories);
    if (allTransactions.some((transaction) => transaction.type === "transfer")) {
      options.push({ value: TRANSFER_TRANSACTION_CATEGORY, label: "Transfer" });
    }
    return options.sort((left, right) => left.label.localeCompare(right.label));
  }, [allTransactions, categories]);

  const resetFilters = useCallback(() => {
    setDescriptionFilter("");
    setCategoryFilter(ALL_TRANSACTION_CATEGORIES);
    setDateRange(undefined);
    setMinAmount("");
    setMaxAmount("");
  }, []);

  const inspectTransaction = useCallback((transaction: Transaction) => {
    setActiveTransactionId(transaction.id);
    setInspectorCategoryId(transaction.categoryId ?? "");
  }, []);

  const handleEdit = useCallback((transaction: Transaction) => {
    if (!canEditTransaction(transaction)) return;
    inspectTransaction(transaction);
    setSelectedTransaction(transaction);
    setIsSheetOpen(true);
  }, [inspectTransaction]);

  const handleSheetClose = useCallback((open: boolean) => {
    setIsSheetOpen(open);
    if (!open) setSelectedTransaction(null);
  }, []);

  const handleTransactionCreated = useCallback(async (values: any) => {
    const ledgerDate = calendarDateToLedgerDate(values.date);
    await addTransaction({ ...values, date: ledgerDate, ledgerDate });
    toast({ title: "Transaction added", description: "The transaction has been successfully created." });
  }, [addTransaction, toast]);

  const handleTransactionUpdated = useCallback(async (id: string, values: any) => {
    const existing = allTransactions.find((transaction) => transaction.id === id);
    const now = new Date().toISOString();
    const ledgerDate = calendarDateToLedgerDate(values.date);
    await updateTransaction(id, {
      ...values,
      date: ledgerDate,
      ledgerDate,
      ...(existing?.provider === "plaid" ? {
        classificationLocked: true,
        categorizationStatus: "manually-categorized" as const,
        categorizationSource: "manual" as const,
        categorizedAt: now,
        reviewedAt: now,
      } : {}),
    });
    toast({ title: "Transaction updated", description: "The transaction has been successfully updated." });
  }, [allTransactions, toast, updateTransaction]);

  const handleDelete = useCallback(async (id: string) => {
    const transaction = allTransactions.find((item) => item.id === id);
    try {
      await deleteTransaction(id);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      if (activeTransactionId === id) setActiveTransactionId(null);
      toast({
        title: transaction?.type === "transfer" ? "Transfer deleted" : "Transaction deleted",
        description: transaction?.type === "transfer" ? "Both linked account entries were deleted." : "The transaction has been successfully deleted.",
      });
    } catch {
      toast({ variant: "destructive", title: "Transaction was not deleted", description: "Please try again." });
    }
  }, [activeTransactionId, allTransactions, deleteTransaction, toast]);

  const assignCategory = useCallback(async (ids: string[], categoryId: string) => {
    const categoryResult = findCategoryWithPathById(categoryId, categories);
    if (!categoryResult) throw new Error("Choose a valid category.");
    const root = categoryResult.path[0];
    const categoryType = "type" in root ? root.type : undefined;
    const now = new Date().toISOString();
    const transactions = ids
      .map((id) => allTransactions.find((transaction) => transaction.id === id))
      .filter((transaction): transaction is Transaction => Boolean(transaction))
      .filter((transaction) => transaction.type === categoryType && !transaction.allocations?.length && canEditTransaction(transaction));
    if (transactions.length === 0) throw new Error("The selected transactions cannot use that category.");
    await Promise.all(transactions.map((transaction) => updateTransaction(transaction.id, {
      categoryId,
      category: categoryResult.category.name,
      ...(transaction.provider === "plaid" ? {
        classificationLocked: true,
        categorizationStatus: "manually-categorized" as const,
        categorizationSource: "manual" as const,
        categorizedAt: now,
        reviewedAt: now,
      } : {}),
    })));
    return transactions.length;
  }, [allTransactions, categories, updateTransaction]);

  const applyBulkCategory = useCallback(async () => {
    if (!bulkCategoryId || selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      const count = await assignCategory([...selectedIds], bulkCategoryId);
      setSelectedIds(new Set());
      setBulkCategoryId("");
      toast({ title: `${count} transaction${count === 1 ? "" : "s"} categorized`, description: "The working ledger has been updated." });
    } catch (error) {
      toast({ variant: "destructive", title: "Category was not applied", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setBulkSaving(false);
    }
  }, [assignCategory, bulkCategoryId, selectedIds, toast]);

  const saveAndNext = useCallback(async () => {
    if (!activeTransactionId || !inspectorCategoryId) return;
    const index = filteredTransactions.findIndex((transaction) => transaction.id === activeTransactionId);
    const nextTransaction = filteredTransactions[index + 1] ?? filteredTransactions[index - 1];
    setBulkSaving(true);
    try {
      await assignCategory([activeTransactionId], inspectorCategoryId);
      toast({ title: "Category saved" });
      if (nextTransaction) inspectTransaction(nextTransaction);
    } catch (error) {
      toast({ variant: "destructive", title: "Category was not saved", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setBulkSaving(false);
    }
  }, [activeTransactionId, assignCategory, filteredTransactions, inspectorCategoryId, inspectTransaction, toast]);

  const toggleSelected = useCallback((id: string, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
    setBulkCategoryId("");
  }, []);

  const togglePage = useCallback((selected: boolean) => {
    const ids = paginatedTransactions
      .filter((transaction) => transaction.type !== "transfer" && !transaction.allocations?.length && canEditTransaction(transaction))
      .map((transaction) => transaction.id);
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    setBulkCategoryId("");
  }, [paginatedTransactions]);

  const isFiltering = Boolean(descriptionFilter || categoryFilter !== ALL_TRANSACTION_CATEGORIES || dateRange || minAmount || maxAmount);
  const reviewCount = allTransactions.filter(isTransactionReviewable).length;

  if (userDataLoading && allTransactions.length === 0) return <TransactionsSkeleton />;

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Ledger activity</p>
          <h1 className="mt-1 font-headline text-2xl font-bold tracking-tight text-[#293A5E] dark:text-foreground sm:text-3xl">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search, review, categorize, and export the current account scope.</p>
        </div>
        <ViewSwitcher />
      </div>

      <TransactionsLayouts
        layout={uiLayout}
        allTransactions={allTransactions}
        filteredTransactions={filteredTransactions}
        paginatedTransactions={paginatedTransactions}
        categories={categories}
        categoryOptions={categoryOptions}
        filters={{ description: descriptionFilter, category: categoryFilter, dateRange, minAmount, maxAmount }}
        onDescriptionChange={setDescriptionFilter}
        onCategoryChange={setCategoryFilter}
        onDateRangeChange={setDateRange}
        onMinAmountChange={setMinAmount}
        onMaxAmountChange={setMaxAmount}
        onResetFilters={resetFilters}
        isFiltering={isFiltering}
        loading={userDataLoading}
        page={page}
        totalPages={totalPages}
        pageSize={TRANSACTIONS_PAGE_SIZE}
        onPageChange={setPage}
        isMobile={isMobile}
        activeYear={activeYear}
        isReadOnly={isReadOnly}
        reviewCount={reviewCount}
        onExport={() => setIsExportOpen(true)}
        onEdit={handleEdit}
        onDelete={(id) => void handleDelete(id)}
        activeTransactionId={activeTransactionId}
        onInspect={inspectTransaction}
        selectedIds={selectedIds}
        onToggleSelected={toggleSelected}
        onTogglePage={togglePage}
        inspectorCategoryId={inspectorCategoryId}
        onInspectorCategoryChange={setInspectorCategoryId}
        onSaveAndNext={saveAndNext}
        bulkCategoryId={bulkCategoryId}
        onBulkCategoryChange={setBulkCategoryId}
        onApplyBulkCategory={applyBulkCategory}
        bulkSaving={bulkSaving}
      />

      {isExportOpen ? <ExportTransactionsDialog transactions={allTransactions} categories={categories} isOpen={isExportOpen} onOpenChange={setIsExportOpen} /> : null}
      {isSheetOpen ? (
        <NewTransactionSheet
          isOpen={isSheetOpen}
          onOpenChange={handleSheetClose}
          transaction={selectedTransaction}
          onTransactionCreated={handleTransactionCreated}
          onTransactionUpdated={handleTransactionUpdated}
          categories={categories}
          prioritizeCategory={uiLayout === "financial-brief" && Boolean(selectedTransaction && isTransactionReviewable(selectedTransaction))}
          historicalEditYear={selectedTransaction ? historicalTransactionYear(selectedTransaction, systemYear) : undefined}
        />
      ) : null}
    </div>
  );
}
