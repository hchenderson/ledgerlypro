
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
import { useUserData } from "@/hooks/use-user-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/hooks/use-auth";
import { collection, query, orderBy, limit, startAfter, where, getDocs, getCountFromServer, QueryConstraint, DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ExportTransactionsDialog } from "@/components/export-transactions-dialog";


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

const TRANSACTIONS_PAGE_SIZE = 25;

export default function TransactionsPage() {
  const { user } = useAuth();
  const { 
    updateTransaction, 
    deleteTransaction, 
    categories = [], 
  } = useUserData();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactionsForExport, setAllTransactionsForExport] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [totalTransactions, setTotalTransactions] = useState(0);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
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
  
  const fetchTransactions = useCallback(async (reset: boolean = false) => {
    if (!user) return;
    setLoading(true);

    const collRef = collection(db, 'users', user.uid, 'transactions');
    const queryConstraints: QueryConstraint[] = [];
    
    // Server-side filtering
    if (filters.category) queryConstraints.push(where("category", "==", filters.category));
    if (filters.dateRange?.from) queryConstraints.push(where("date", ">=", filters.dateRange.from.toISOString()));
    if (filters.dateRange?.to) {
        // Adjust to to be end of day
        const toDate = new Date(filters.dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        queryConstraints.push(where("date", "<=", toDate.toISOString()));
    }
    if (filters.minAmount !== undefined) queryConstraints.push(where("amount", ">=", filters.minAmount));
    if (filters.maxAmount !== undefined) queryConstraints.push(where("amount", "<=", filters.maxAmount));
    
    // Server-side filtering for description with prefix search
    if (filters.description) {
        queryConstraints.push(where("description", ">=", filters.description));
        queryConstraints.push(where("description", "<=", filters.description + '\uf8ff'));
    }

    const countQuery = query(collRef, ...queryConstraints.filter(c => c.type !== 'orderBy' && c.type !== 'limit' && c.type !== 'startAfter'));
    
    let q = query(collRef, ...queryConstraints);
    q = query(q, orderBy("date", "desc"));
    
    const currentLastVisible = reset ? null : lastVisible;

    if (currentLastVisible) {
      q = query(q, startAfter(currentLastVisible));
    }
    q = query(q, limit(TRANSACTIONS_PAGE_SIZE));

    try {
      if (reset) {
        const totalCountSnap = await getCountFromServer(countQuery);
        setTotalTransactions(totalCountSnap.data().count);
      }

      const docsSnap = await getDocs(q);
      const docsData = docsSnap.docs.map(doc => doc.data() as Transaction);
      
      setHasMore(docsSnap.docs.length === TRANSACTIONS_PAGE_SIZE);
      setLastVisible(docsSnap.docs[docsSnap.docs.length - 1] || null);
      setTransactions(prev => (reset ? docsData : [...prev, ...docsData]));
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch transactions." });
    } finally {
      setLoading(false);
    }
  }, [user, filters, lastVisible, toast]);

  useEffect(() => {
    fetchTransactions(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, user]);

  useEffect(() => {
    if (!user) return;
    const fetchAllForExport = async () => {
        const collRef = collection(db, 'users', user.uid, 'transactions');
        const q = query(collRef, orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        setAllTransactionsForExport(querySnapshot.docs.map(doc => doc.data() as Transaction));
    }
    fetchAllForExport();
  }, [user]);

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
  
  const handleSaveTransaction = useCallback(async () => {
    await fetchTransactions(true);
  }, [fetchTransactions]);

  const handleDelete = useCallback(async (id: string) => {
      try {
        await deleteTransaction(id);
        setTransactions(prev => prev.filter(t => t.id !== id));
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
  
  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchTransactions(false);
    }
  }, [fetchTransactions, hasMore, loading]);

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

  const formatDate = useCallback((dateString: string) => {
    try {
      return format(new Date(dateString), "MMMM d, yyyy");
    } catch {
      return 'Invalid date';
    }
  }, []);
  
  if (loading && transactions.length === 0) {
    return <TransactionsSkeleton />;
  }

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              Showing {transactions.length} of {totalTransactions} transactions.
            </CardDescription>
          </div>
          <ExportTransactionsDialog
            transactions={allTransactionsForExport}
            categories={categories}
            triggerButton={
                 <Button 
                    variant="outline"
                    disabled={allTransactionsForExport.length === 0}
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
              {transactions.map((transaction) => (
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

      <NewTransactionSheet 
        isOpen={isSheetOpen}
        onOpenChange={handleSheetClose}
        transaction={selectedTransaction}
        onTransactionCreated={() => {
            handleSaveTransaction();
            toast({ title: "Transaction Added", description: "The transaction has been successfully created." });
        }}
        onTransactionUpdated={() => {
            handleSaveTransaction();
            toast({ title: "Transaction Updated", description: "The transaction has been successfully updated." });
        }}
        categories={categories}
      />
    </div>
  );
}
