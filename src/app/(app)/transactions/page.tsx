
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { MoreHorizontal, Upload, Calendar as CalendarIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NewTransactionSheet } from "@/components/new-transaction-sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Transaction, Category, SubCategory } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useUserData } from "@/hooks/use-user-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { ExportTransactionsDialog } from "@/components/export-transactions-dialog";
import { Pagination } from "@/components/ui/pagination";


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
    allTransactions,
    addTransaction,
    updateTransaction, 
    deleteTransaction, 
    categories = [],
    loading: userDataLoading,
  } = useUserData();
  
  const [paginatedTransactions, setPaginatedTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const { toast } = useToast();

  // Filter states
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const filteredTransactions = useMemo(() => {
    let transactions = [...allTransactions];

    // Apply description filter
    if (descriptionFilter) {
      transactions = transactions.filter(t => 
        t.description.toLowerCase().includes(descriptionFilter.toLowerCase())
      );
    }
    
    // Apply category filter
    if (categoryFilter !== 'all') {
      transactions = transactions.filter(t => t.category === categoryFilter);
    }

    // Apply date range filter
    if (dateRange?.from) {
      transactions = transactions.filter(t => new Date(t.date) >= dateRange.from!);
    }
    if (dateRange?.to) {
       const toDate = new Date(dateRange.to);
       toDate.setHours(23, 59, 59, 999);
      transactions = transactions.filter(t => new Date(t.date) <= toDate);
    }

    // Apply amount filters
    const min = minAmount ? parseFloat(minAmount) : -Infinity;
    const max = maxAmount ? parseFloat(maxAmount) : Infinity;
    if (minAmount || maxAmount) {
        transactions = transactions.filter(t => t.amount >= min && t.amount <= max);
    }

    return transactions;
  }, [allTransactions, descriptionFilter, categoryFilter, dateRange, minAmount, maxAmount]);
  
   useEffect(() => {
    setPage(1); // Reset page to 1 when filters change
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
    return options;
  }, [categories]);

  const resetFilters = useCallback(() => {
    setDescriptionFilter('');
    setCategoryFilter('all');
    setDateRange(undefined);
    setMinAmount('');
    setMaxAmount('');
  }, []);

  const handleEdit = useCallback((transaction: Transaction) => {
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
    await updateTransaction(id, {...values, date: values.date.toISOString()});
    toast({ title: "Transaction Updated", description: "The transaction has been successfully updated." });
  }, [updateTransaction, toast]);

  const handleDelete = useCallback(async (id: string) => {
      try {
        await deleteTransaction(id);
        toast({
          title: "Transaction Deleted",
          description: "The transaction has been successfully deleted.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete transaction. Please try again.",
        });
      }
  }, [deleteTransaction, toast]);
  
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return format(new Date(dateString), "MMMM d, yyyy");
  }, []);
  
  const isFiltering = descriptionFilter || categoryFilter !== 'all' || dateRange || minAmount || maxAmount;

  if (userDataLoading && allTransactions.length === 0) {
    return <TransactionsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          
          <div className="flex items-center gap-2 lg:col-span-2">
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
          
          <div className="lg:col-span-2 flex justify-end">
            <Button onClick={resetFilters} variant="ghost" disabled={!isFiltering}>
              <X className="mr-2 h-4 w-4"/>
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
             <CardDescription>
              {isFiltering
                ? `Found ${filteredTransactions.length} transactions matching your filters.`
                : `Showing ${filteredTransactions.length > 0 ? (page - 1) * TRANSACTIONS_PAGE_SIZE + 1 : 0}-${Math.min(page * TRANSACTIONS_PAGE_SIZE, filteredTransactions.length)} of ${allTransactions.length} total transactions.`
              }
            </CardDescription>
          </div>
          <ExportTransactionsDialog
            transactions={allTransactions}
            categories={categories}
            triggerButton={
                 <Button 
                    variant="outline"
                    disabled={allTransactions.length === 0}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Export
                  </Button>
            }
           />
        </CardHeader>
        
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
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
                    <TableCell colSpan={5} className="h-24 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </TableCell>
                </TableRow>
              ) : paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((transaction) => (
                  <TableRow key={transaction.id} className="cursor-pointer" onClick={() => handleEdit(transaction)}>
                    <TableCell className="font-medium">
                      {transaction.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {transaction.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatDate(transaction.date)}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${transaction.type === 'income' ? 'text-emerald-600' : ''}`}>
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => handleEdit(transaction)}>
                              Edit
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem 
                                className="text-red-600 focus:text-red-600"
                                onSelect={(e) => e.preventDefault()}
                              >
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete this transaction.
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
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No transactions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
           {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>

      <NewTransactionSheet 
        isOpen={isSheetOpen}
        onOpenChange={handleSheetClose}
        transaction={selectedTransaction}
        onTransactionCreated={handleTransactionCreated}
        onTransactionUpdated={handleTransactionUpdated}
        categories={categories}
      />
    </div>
  );
}
