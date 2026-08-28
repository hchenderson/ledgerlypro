
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { MoreHorizontal, Upload, Calendar as CalendarIcon, X, Loader2, Edit, Trash2, ArrowRightLeft, ListChecks, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Transaction, Category, SubCategory } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/use-categories";
import { useTransactionData } from "@/hooks/use-transactions";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Pagination } from "@/components/ui/pagination";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import dynamic from "next/dynamic";
import { useAccounts } from "@/hooks/use-accounts";
import { useEnvelopes } from "@/hooks/use-envelopes";
import { isTransactionReviewable } from "@/lib/categorization";
import {
  allocationsAreComplete,
  expandTransactionAllocations,
} from "@/lib/transaction-allocations";
import {
  canEditTransaction,
  historicalTransactionYear,
} from "@/lib/transaction-edit-policy";

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
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TransactionsPage() {
  const {
    transactions: allTransactions,
    addTransaction,
    updateTransaction, 
    deleteTransaction, 
    loading: userDataLoading,
  } = useTransactionData();
  const { categories = [] } = useCategories();
  const { getAccountName } = useAccounts();
  const { getEnvelopeName } = useEnvelopes();
  const { activeYear } = useAuth();
  const isMobile = useIsMobile();
  
  const [paginatedTransactions, setPaginatedTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const { toast } = useToast();

  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const systemYear = new Date().getFullYear();
  const isReadOnly = activeYear < systemYear;

  const filteredTransactions = useMemo(() => {
    let transactions = [...allTransactions];

    if (descriptionFilter) {
      transactions = transactions.filter(t => 
        t.description.toLowerCase().includes(descriptionFilter.toLowerCase())
      );
    }
    
    if (categoryFilter !== 'all') {
      transactions = transactions.filter((transaction) =>
        expandTransactionAllocations(transaction).some(
          (entry) => entry.category === categoryFilter,
        ),
      );
    }

    if (dateRange?.from) {
      transactions = transactions.filter(t => new Date(t.date) >= dateRange.from!);
    }
    if (dateRange?.to) {
       const toDate = new Date(dateRange.to);
       toDate.setHours(23, 59, 59, 999);
      transactions = transactions.filter(t => new Date(t.date) <= toDate);
    }

    const min = minAmount ? parseFloat(minAmount) : -Infinity;
    const max = maxAmount ? parseFloat(maxAmount) : Infinity;
    if (minAmount || maxAmount) {
        transactions = transactions.filter(t => t.amount >= min && t.amount <= max);
    }

    return transactions;
  }, [allTransactions, descriptionFilter, categoryFilter, dateRange, minAmount, maxAmount]);
  
   useEffect(() => {
    setPage(1);
  }, [filteredTransactions]);

  useEffect(() => {
    const startIndex = (page - 1) * TRANSACTIONS_PAGE_SIZE;
    const endIndex = page * TRANSACTIONS_PAGE_SIZE;
    setPaginatedTransactions(filteredTransactions.slice(startIndex, endIndex));
  }, [page, filteredTransactions]);

  const totalPages = Math.ceil(filteredTransactions.length / TRANSACTIONS_PAGE_SIZE);

  const allCategoryOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const recurse = (cats: (Category | SubCategory)[]) => {
      cats.forEach(c => {
        options.push({ value: c.name, label: c.name });
        if(c.subCategories) recurse(c.subCategories);
      });
    };
    recurse(categories);
    if (allTransactions.some((transaction) => transaction.type === "transfer")) {
      options.push({ value: "Transfer", label: "Transfer" });
    }
    return options;
  }, [allTransactions, categories]);

  const resetFilters = useCallback(() => {
    setDescriptionFilter('');
    setCategoryFilter('all');
    setDateRange(undefined);
    setMinAmount('');
    setMaxAmount('');
  }, []);

  const handleEdit = useCallback((transaction: Transaction) => {
    if (!canEditTransaction(transaction)) return;
    setSelectedTransaction(transaction);
    setIsSheetOpen(true);
  }, []);
  
  const handleSheetClose = useCallback((open: boolean) => {
    if (!open) {
      setSelectedTransaction(null);
    }
    setIsSheetOpen(open);
  }, []);
  
  const handleTransactionCreated = useCallback(async (values: any) => {
    await addTransaction({...values, date: values.date.toISOString()});
    toast({ title: "Transaction Added", description: "The transaction has been successfully created." });
  }, [addTransaction, toast]);

  const handleTransactionUpdated = useCallback(async (id: string, values: any) => {
    const existing = allTransactions.find((transaction) => transaction.id === id);
    const now = new Date().toISOString();
    await updateTransaction(id, {
      ...values,
      date: values.date.toISOString(),
      ...(existing?.provider === "plaid"
        ? {
            classificationLocked: true,
            categorizationStatus: "manually-categorized" as const,
            categorizationSource: "manual" as const,
            categorizedAt: now,
            reviewedAt: now,
          }
        : {}),
    });
    toast({ title: "Transaction Updated", description: "The transaction has been successfully updated." });
  }, [allTransactions, updateTransaction, toast]);

  const handleDelete = useCallback(async (id: string) => {
      const transaction = allTransactions.find((item) => item.id === id);
      try {
        await deleteTransaction(id);
        toast({
          title: transaction?.type === "transfer" ? "Transfer deleted" : "Transaction deleted",
          description:
            transaction?.type === "transfer"
              ? "Both linked account entries were deleted."
              : "The transaction has been successfully deleted.",
        });
      } catch {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete transaction. Please try again.",
        });
      }
  }, [allTransactions, deleteTransaction, toast]);

  const transactionSign = useCallback((transaction: Transaction) => {
    if (transaction.type === "income") return "+";
    if (transaction.type === "expense") return "-";
    return transaction.transferDirection === "in" ? "+" : "-";
  }, []);

  const transactionAmountClass = useCallback((transaction: Transaction) => {
    if (transaction.type === "income") return "text-emerald-600";
    if (transaction.type === "transfer") return "text-primary";
    return "";
  }, []);
  
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return format(new Date(dateString), "MMMM d, yyyy");
  }, []);
  
  const isFiltering = descriptionFilter || categoryFilter !== 'all' || dateRange || minAmount || maxAmount;
  const reviewCount = allTransactions.filter(isTransactionReviewable).length;

  if (userDataLoading && allTransactions.length === 0) {
    return <TransactionsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {isReadOnly ? (
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm"
        >
          <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium">Correcting historical transactions</p>
            <p className="mt-1 text-muted-foreground">
              You can edit {activeYear} income and expenses. Ledgerly will ask
              for confirmation before recalculating historical results. Adding,
              importing, deleting, and transfers remain unavailable in a past
              year.
            </p>
          </div>
        </div>
      ) : null}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <Input 
            placeholder="Filter by description..."
            value={descriptionFilter}
            onChange={(e) => setDescriptionFilter(e.target.value)}
            className="lg:col-span-1"
          />
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="lg:col-span-1">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {allCategoryOptions.sort((a,b) => a.label.localeCompare(b.label)).map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal lg:col-span-2",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={isMobile ? 1 : 2}
              />
            </PopoverContent>
          </Popover>
          
          <div className="grid grid-cols-2 gap-2 lg:col-span-2">
            <Input 
              type="number"
              placeholder="Min amount"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
            <Input 
              type="number"
              placeholder="Max amount"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>
          
          <div className="flex lg:col-span-2 lg:justify-end">
            <Button
              onClick={resetFilters}
              variant="ghost"
              disabled={!isFiltering}
              className="h-11 w-full sm:w-auto"
            >
              <X className="mr-2 h-4 w-4"/>
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Transactions</CardTitle>
             <CardDescription className="mt-1">
              {isFiltering
                ? `Found ${filteredTransactions.length} transactions matching your filters.`
                : `Showing ${filteredTransactions.length > 0 ? (page - 1) * TRANSACTIONS_PAGE_SIZE + 1 : 0}-${Math.min(page * TRANSACTIONS_PAGE_SIZE, filteredTransactions.length)} of ${allTransactions.length} total transactions.`
              }
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="h-11 w-full sm:w-auto" asChild>
              <Link href="/transactions/review">
                <ListChecks className="mr-2 h-4 w-4" />
                Needs categorization{reviewCount > 0 ? ` (${reviewCount})` : ""}
              </Link>
            </Button>
            <Button
              variant="outline"
              disabled={allTransactions.length === 0}
              className="h-11 w-full sm:w-auto"
              onClick={() => setIsExportOpen(true)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
          {isExportOpen ? (
            <ExportTransactionsDialog
              transactions={allTransactions}
              categories={categories}
              isOpen={isExportOpen}
              onOpenChange={setIsExportOpen}
            />
          ) : null}
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3 md:hidden">
            {userDataLoading && allTransactions.length === 0 ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : paginatedTransactions.length > 0 ? (
              paginatedTransactions.map((transaction) => (
                <article
                  key={transaction.id}
                  className="rounded-xl border bg-card p-4 shadow-sm"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{transaction.description}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="max-w-full truncate">
                          {transaction.allocations?.length
                            ? `Split · ${transaction.allocations.length} categories`
                            : transaction.category}
                        </Badge>
                        <Badge variant="secondary" className="max-w-full truncate">
                          {getAccountName(transaction.accountId)}
                        </Badge>
                        {transaction.envelopeId ? (
                          <Badge variant="outline" className="max-w-full truncate border-primary/30 text-primary">
                            {getEnvelopeName(transaction.envelopeId)} envelope
                          </Badge>
                        ) : null}
                        {transaction.type === "transfer" ? (
                          <Badge className="gap-1">
                            <ArrowRightLeft className="h-3 w-3" />
                            {transaction.transferDirection === "in"
                              ? "Transfer in"
                              : "Transfer out"}
                          </Badge>
                        ) : null}
                        {transaction.postingStatus === "pending" ? (
                          <Badge variant="outline">Pending</Badge>
                        ) : null}
                        {transaction.postingStatus === "removed" ? (
                          <Badge variant="outline">Removed by bank</Badge>
                        ) : null}
                        {transaction.allocations?.length && !allocationsAreComplete(transaction.amount, transaction.allocations) ? (
                          <Badge variant="destructive">Incomplete split</Badge>
                        ) : null}
                        {isTransactionReviewable(transaction) ? (
                          <Badge variant="destructive">Needs category</Badge>
                        ) : transaction.categorizationSource === "rule" ? (
                          <Badge variant="secondary">Auto</Badge>
                        ) : null}
                        <time
                          dateTime={transaction.date}
                          className="text-xs text-muted-foreground"
                        >
                          {formatDate(transaction.date)}
                        </time>
                      </div>
                    </div>
                    <p
                      className={cn(
                        "max-w-[50%] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono font-semibold",
                        transactionAmountClass(transaction)
                      )}
                    >
                      {transactionSign(transaction)}
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      onClick={() => handleEdit(transaction)}
                      disabled={!canEditTransaction(transaction)}
                      aria-label={`Edit ${transaction.description}`}
                      title={
                        transaction.type === "transfer"
                          ? "Linked transfers are edited together and cannot be edited here."
                          : isReadOnly
                            ? `Edit this ${activeYear} transaction. You will confirm before its historical reports change.`
                            : undefined
                      }
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 text-destructive hover:text-destructive"
                          disabled={isReadOnly}
                          aria-label={`Delete ${transaction.description}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {transaction.type === "transfer"
                              ? `This will permanently delete both linked entries for ${transaction.description}.`
                              : `This will permanently delete ${transaction.description}.`}{" "}
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(transaction.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </article>
              ))
            ) : (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">
                No transactions found.
              </div>
            )}
          </div>

          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden lg:table-cell">Account</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userDataLoading && allTransactions.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </TableCell>
                </TableRow>
              ) : paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((transaction) => (
                  <TableRow 
                    key={transaction.id} 
                    onClick={() => handleEdit(transaction)}
                    className={cn(
                      canEditTransaction(transaction) &&
                        "cursor-pointer",
                    )}
                  >
                    <TableCell className="font-medium max-w-[120px] sm:max-w-xs truncate">
                      {transaction.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {transaction.allocations?.length
                          ? `Split · ${transaction.allocations.length} categories`
                          : transaction.category}
                      </Badge>
                      {transaction.envelopeId ? (
                        <Badge variant="outline" className="ml-2 hidden border-primary/30 text-primary xl:inline-flex">
                          {getEnvelopeName(transaction.envelopeId)}
                        </Badge>
                      ) : null}
                      {transaction.type === "transfer" ? (
                        <Badge className="ml-2 hidden xl:inline-flex">
                          {transaction.transferDirection === "in"
                            ? "In"
                            : "Out"}
                        </Badge>
                      ) : null}
                      {transaction.postingStatus === "pending" ? (
                        <Badge variant="outline" className="ml-2">Pending</Badge>
                      ) : null}
                      {transaction.postingStatus === "removed" ? (
                        <Badge variant="outline" className="ml-2">Removed</Badge>
                      ) : null}
                      {transaction.allocations?.length && !allocationsAreComplete(transaction.amount, transaction.allocations) ? (
                        <Badge variant="destructive" className="ml-2">Incomplete split</Badge>
                      ) : null}
                      {isTransactionReviewable(transaction) ? (
                        <Badge variant="destructive" className="ml-2 hidden xl:inline-flex">Needs category</Badge>
                      ) : transaction.categorizationSource === "rule" ? (
                        <Badge variant="secondary" className="ml-2 hidden xl:inline-flex">Auto</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden max-w-44 truncate lg:table-cell">
                      {getAccountName(transaction.accountId)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatDate(transaction.date)}
                    </TableCell>
                    <TableCell className={cn("text-right font-mono", transactionAmountClass(transaction))}>
                      {transactionSign(transaction)}
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onSelect={() => handleEdit(transaction)}
                              disabled={transaction.type === "transfer"}
                            >
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem 
                                    className="text-red-600 focus:text-red-600"
                                    onSelect={(e) => e.preventDefault()}
                                    disabled={isReadOnly}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone.{" "}
                                      {transaction.type === "transfer"
                                        ? "Both linked transfer entries will be permanently deleted."
                                        : "This transaction will be permanently deleted."}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDelete(transaction.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No transactions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          
           {totalPages > 1 && (
            <div className="overflow-x-auto">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                pageNeighbours={isMobile ? 0 : 1}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {isSheetOpen ? (
        <NewTransactionSheet
          isOpen={isSheetOpen}
          onOpenChange={handleSheetClose}
          transaction={selectedTransaction}
          onTransactionCreated={handleTransactionCreated}
          onTransactionUpdated={handleTransactionUpdated}
          categories={categories}
          historicalEditYear={
            selectedTransaction
              ? historicalTransactionYear(selectedTransaction, systemYear)
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
