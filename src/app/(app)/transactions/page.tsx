
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
import { useAuth } from "@/hooks/use-auth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";

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
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}


export default function TransactionsPage() {
  const { transactions, loading, addTransaction, updateTransaction, deleteTransaction, categories, fetchTransactions, hasMore, totalTransactions } = useUserData();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const { toast } = useToast();
  const { plan } = useAuth();

  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  
  const debouncedDescription = useDebounce(descriptionFilter, 500);
  const debouncedMinAmount = useDebounce(minAmount, 500);
  const debouncedMaxAmount = useDebounce(maxAmount, 500);
  
  const isPro = plan === 'pro';
  
  const filters = useMemo(() => ({
    description: debouncedDescription,
    category: categoryFilter,
    dateRange,
    minAmount: debouncedMinAmount ? parseFloat(debouncedMinAmount) : undefined,
    maxAmount: debouncedMaxAmount ? parseFloat(debouncedMaxAmount) : undefined,
  }), [debouncedDescription, categoryFilter, dateRange, debouncedMinAmount, debouncedMaxAmount]);
  
  useEffect(() => {
      fetchTransactions(true, filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const allCategories = useMemo(() => {
    const flattenCategories = (cats: (Category | SubCategory)[]): string[] => {
        return cats.flatMap(c => {
            const names = [c.name];
            if(c.subCategories) {
                return names.concat(flattenCategories(c.subCategories))
            }
            return names;
        })
    }
    return flattenCategories(categories);
  }, [categories]);

  const resetFilters = () => {
    setDescriptionFilter('');
    setCategoryFilter('all');
    setDateRange(undefined);
    setMinAmount('');
    setMaxAmount('');
  }

  const handleEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsSheetOpen(true);
  };
  
  const handleSheetClose = (open: boolean) => {
    if (!open) {
      setSelectedTransaction(null);
    }
    setIsSheetOpen(open);
  }
  
  const handleTransactionCreated = (values: Omit<Transaction, 'id' | 'type'> & { type: "income" | "expense" }) => {
     addTransaction({
      ...values,
      date: values.date.toISOString()
    });
  }

  const handleTransactionUpdated = (id: string, values: Omit<Transaction, 'id' | 'type'> & { type: "income" | "expense" }) => {
    updateTransaction(id, { ...values, date: values.date.toISOString() });
  };
  
  const handleDelete = (id: string) => {
    deleteTransaction(id);
    toast({
      title: "Transaction Deleted",
      description: "The transaction has been successfully deleted.",
    })
  }
  
  const handleExport = () => {
    if (!isPro) return;
    const csv = Papa.unparse(transactions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'transactions.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Export Successful",
      description: "Your transactions have been exported to transactions.csv.",
    });
  }
  
  if (loading && transactions.length === 0) return <TransactionsSkeleton />;

  return (
    <div className="space-y-6">
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
              variant={"outline"}
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
              onChange={e => setMinAmount(e.target.value)}
            />
             <Input 
              type="number"
              placeholder="Max amount"
              value={maxAmount}
              onChange={e => setMaxAmount(e.target.value)}
            />
        </div>
        <Button onClick={resetFilters} variant="ghost">
            <X className="mr-2 h-4 w-4"/>
            Reset
        </Button>
       </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
                Showing {transactions.length} of {totalTransactions} transactions.
            </CardDescription>
        </div>
         <Tooltip>
            <TooltipTrigger asChild>
                 <div className="inline-block"> {/* Wrapper div for tooltip on disabled button */}
                    <Button onClick={handleExport} variant="outline" disabled={!isPro}>
                        <Upload className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </div>
            </TooltipTrigger>
            {!isPro && (
                 <TooltipContent>
                    <p>Upgrade to Pro to export transactions.</p>
                </TooltipContent>
            )}
        </Tooltip>
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
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="font-medium">{transaction.description}</TableCell>
                <TableCell>
                  <Badge variant="outline">{transaction.category}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {format(new Date(transaction.date), "MMMM d, yyyy")}
                </TableCell>
                <TableCell className={`text-right font-code ${transaction.type === 'income' ? 'text-emerald-600' : ''}`}>
                  {transaction.type === 'income' ? '+' : '-'}
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(transaction.amount)}
                </TableCell>
                <TableCell>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleEdit(transaction)}>Edit</DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start text-sm p-1.5 h-auto font-normal text-red-600 hover:text-red-700">
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete this transaction.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(transaction.id)} className="bg-red-600 hover:bg-red-700">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
             {transactions.length === 0 && !loading && (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        No transactions found matching your filters.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
        {hasMore && (
            <div className="flex justify-center mt-4">
                <Button onClick={() => fetchTransactions(false, filters)} disabled={loading}>
                    {loading ? 'Loading...' : 'Load More'}
                </Button>
            </div>
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

    