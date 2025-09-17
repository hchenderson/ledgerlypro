
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { MoreHorizontal, Upload, Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NewTransactionSheet } from "@/components/new-transaction-sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Transaction, Category, SubCategory } from "@/types";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { useUserData } from "@/hooks/use-user-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";

// Custom hook with proper typing
const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

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

// Define proper types for filters
interface TransactionFilters {
  description?: string;
  category?: string;
  dateRange?: DateRange;
  minAmount?: number;
  maxAmount?: number;
}

export default function TransactionsPage() {
  const { 
    paginatedTransactions = [], 
    loading = false, 
    addTransaction, 
    updateTransaction, 
    deleteTransaction, 
    categories = [], 
    fetchPaginatedTransactions, 
    hasMore = false, 
    totalPaginatedTransactions = 0 
  } = useUserData();
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const { toast } = useToast();

  // Filter states
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  
  // Debounced values
  const debouncedDescription = useDebounce(descriptionFilter, 500);
  const debouncedMinAmount = useDebounce(minAmount, 500);
  const debouncedMaxAmount = useDebounce(maxAmount, 500);
  
  // Memoized filters object
  const filters = useMemo((): TransactionFilters => ({
    description: debouncedDescription || undefined,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    dateRange: dateRange,
    minAmount: debouncedMinAmount && !isNaN(parseFloat(debouncedMinAmount)) ? parseFloat(debouncedMinAmount) : undefined,
    maxAmount: debouncedMaxAmount && !isNaN(parseFloat(debouncedMaxAmount)) ? parseFloat(debouncedMaxAmount) : undefined,
  }), [debouncedDescription, categoryFilter, dateRange, debouncedMinAmount, debouncedMaxAmount]);
  
  // Fetch transactions when filters change
  useEffect(() => {
    if (fetchPaginatedTransactions) {
      fetchPaginatedTransactions(true, filters);
    }
  }, [filters, fetchPaginatedTransactions]);

  // Flatten categories safely
  const allCategories = useMemo(() => {
    const flattenCategories = (cats: (Category | SubCategory)[]): string[] => {
      if (!Array.isArray(cats)) return [];
      
      return cats.reduce<string[]>((acc, c) => {
        if (!c || typeof c !== 'object') return acc;
        
        if (c.name && typeof c.name === 'string') {
          acc.push(c.name);
        }
        
        if (c.subCategories && Array.isArray(c.subCategories)) {
          acc.push(...flattenCategories(c.subCategories));
        }
        
        return acc;
      }, []);
    };
    
    return flattenCategories(categories);
  }, [categories]);

  // Reset filters function
  const resetFilters = useCallback(() => {
    setDescriptionFilter('');
    setCategoryFilter('all');
    setDateRange(undefined);
    setMinAmount('');
    setMaxAmount('');
    
    if (fetchPaginatedTransactions) {
      fetchPaginatedTransactions(true, {});
    }
  }, [fetchPaginatedTransactions]);

  // Handle edit transaction
  const handleEdit = useCallback((transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsSheetOpen(true);
  }, []);
  
  // Handle sheet close
  const handleSheetClose = useCallback((open: boolean) => {
    if (!open) {
      setSelectedTransaction(null);
    }
    setIsSheetOpen(open);
  }, []);
  
  // Handle transaction creation
  const handleTransactionCreated = useCallback((values: Omit<Transaction, 'id' | 'type'> & { type: "income" | "expense" }) => {
    if (addTransaction) {
      try {
        addTransaction({
          ...values,
          date: values.date instanceof Date ? values.date.toISOString() : values.date
        });
        
        toast({
          title: "Transaction Added",
          description: "The transaction has been successfully created.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create transaction. Please try again.",
        });
      }
    }
  }, [addTransaction, toast]);

  // Handle transaction update
  const handleTransactionUpdated = useCallback((id: string, values: Omit<Transaction, 'id' | 'type'> & { type: "income" | "expense" }) => {
    if (updateTransaction) {
      try {
        updateTransaction(id, { 
          ...values, 
          date: values.date instanceof Date ? values.date.toISOString() : values.date 
        });
        
        toast({
          title: "Transaction Updated",
          description: "The transaction has been successfully updated.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update transaction. Please try again.",
        });
      }
    }
  }, [updateTransaction, toast]);
  
  // Handle delete transaction
  const handleDelete = useCallback((id: string) => {
    if (deleteTransaction) {
      try {
        deleteTransaction(id);
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
    }
  }, [deleteTransaction, toast]);
  
  // Handle CSV export
  const handleExport = useCallback(() => {
    try {
      if (!paginatedTransactions || paginatedTransactions.length === 0) {
        toast({
          variant: "destructive",
          title: "No Data",
          description: "No transactions available to export.",
        });
        return;
      }

      const exportData = paginatedTransactions.map(transaction => ({
        Description: transaction.description || '',
        Category: transaction.category || '',
        Date: transaction.date ? format(new Date(transaction.date), "yyyy-MM-dd") : '',
        Amount: transaction.amount || 0,
        Type: transaction.type || ''
      }));

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: "Your transactions have been exported successfully.",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "An error occurred while exporting transactions.",
      });
    }
  }, [paginatedTransactions, toast]);

  // Load more transactions
  const handleLoadMore = useCallback(() => {
    if (fetchPaginatedTransactions && hasMore && !loading) {
      fetchPaginatedTransactions(false, filters);
    }
  }, [fetchPaginatedTransactions, hasMore, loading, filters]);

  // Format currency safely
  const formatCurrency = useCallback((amount: number) => {
    try {
      return new Intl.NumberFormat("en-US", { 
        style: "currency", 
        currency: "USD" 
      }).format(Math.abs(amount) || 0);
    } catch {
      return `$${Math.abs(amount || 0).toFixed(2)}`;
    }
  }, []);

  // Format date safely
  const formatDate = useCallback((dateString: string) => {
    try {
      return format(new Date(dateString), "MMMM d, yyyy");
    } catch {
      return 'Invalid date';
    }
  }, []);
  
  // Show loading skeleton on initial load
  if (loading && paginatedTransactions.length === 0) {
    return <TransactionsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Input 
            placeholder="Filter by description..."
            value={descriptionFilter}
            onChange={(e) => setDescriptionFilter(e.target.value)}
          />
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {allCategories.sort().map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
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
          
          <div className="flex items-center gap-2">
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
          
          <Button onClick={resetFilters} variant="ghost">
            <X className="mr-2 h-4 w-4"/>
            Reset
          </Button>
        </CardContent>
      </Card>

      {/* Transactions Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              Showing {paginatedTransactions.length} of {totalPaginatedTransactions} transactions.
            </CardDescription>
          </div>
          <Button 
            onClick={handleExport} 
            variant="outline"
            disabled={paginatedTransactions.length === 0}
          >
            <Upload className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
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
              {paginatedTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">
                    {transaction.description || 'No description'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {transaction.category || 'Uncategorized'}
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
                          <Button aria-haspopup="true" size="icon" variant="ghost">
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
              ))}
              
              {paginatedTransactions.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No transactions found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button 
                onClick={handleLoadMore} 
                disabled={loading}
                variant="outline"
              >
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New/Edit Transaction Sheet */}
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
