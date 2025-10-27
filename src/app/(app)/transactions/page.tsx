
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
import { useAuth } from "@/hooks/use-auth";
import { collection, query, orderBy, limit, startAfter, where, getDocs, getCountFromServer, QueryConstraint, DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ExportTransactionsDialog } from "@/components/export-transactions-dialog";
import { searchClient, algoliaIndexName, isAlgoliaConfigured } from "@/lib/algolia";
import aa from 'search-insights';

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
  category?: string;
  dateRange?: DateRange;
  minAmount?: number;
  maxAmount?: number;
}

type AlgoliaTransaction = Omit<Transaction, 'id'> & { objectID: string; date_timestamp: number };

const TRANSACTIONS_PAGE_SIZE = 25;

export default function TransactionsPage() {
  const { user } = useAuth();
  const { 
    addTransaction,
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
  const [currentPage, setCurrentPage] = useState(0);
  const [queryID, setQueryID] = useState<string | null>(null);

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
  const debouncedDescription = useDebounce(descriptionFilter, 300);
  const debouncedMinAmount = useDebounce(minAmount, 500);
  const debouncedMaxAmount = useDebounce(maxAmount, 500);

  const searchIndex = useMemo(() => {
    return isAlgoliaConfigured && searchClient ? searchClient.initIndex(algoliaIndexName) : null;
  }, []);
  
  // Memoized filters object
  const filters = useMemo((): TransactionFilters => ({
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    dateRange: dateRange,
    minAmount: debouncedMinAmount && !isNaN(parseFloat(debouncedMinAmount)) ? parseFloat(debouncedMinAmount) : undefined,
    maxAmount: debouncedMaxAmount && !isNaN(parseFloat(debouncedMaxAmount)) ? parseFloat(debouncedMaxAmount) : undefined,
  }), [categoryFilter, dateRange, debouncedMinAmount, debouncedMaxAmount]);
  
  const fetchTransactions = useCallback(async (loadMore: boolean = false) => {
    if (!user) return;
    setLoading(true);

    const pageToFetch = loadMore ? currentPage + 1 : 0;
    const isSearchActive = !!debouncedDescription;

    if (isSearchActive && searchIndex) {
      // --- ALGOLIA SEARCH LOGIC ---
      try {
          const algoliaFilters: string[] = [`_tags:${user.uid}`];
          if (filters.category) {
              algoliaFilters.push(`category:"${filters.category}"`);
          }
          if (filters.dateRange?.from) {
              algoliaFilters.push(`date_timestamp >= ${Math.floor(filters.dateRange.from.getTime() / 1000)}`);
          }
          if (filters.dateRange?.to) {
              const toDate = new Date(filters.dateRange.to);
              toDate.setHours(23, 59, 59, 999);
              algoliaFilters.push(`date_timestamp <= ${Math.floor(toDate.getTime() / 1000)}`);
          }
          if (filters.minAmount !== undefined) algoliaFilters.push(`amount >= ${filters.minAmount}`);
          if (filters.maxAmount !== undefined) algoliaFilters.push(`amount <= ${filters.maxAmount}`);
          
          const { hits, nbHits, nbPages, queryID: newQueryID } = await searchIndex.search<AlgoliaTransaction>(debouncedDescription, {
            filters: algoliaFilters.join(' AND '),
            page: pageToFetch,
            hitsPerPage: TRANSACTIONS_PAGE_SIZE,
            clickAnalytics: true,
          });

          setQueryID(newQueryID);
          
          const searchResults = hits.map(hit => ({ ...hit, id: hit.objectID, date: new Date(hit.date_timestamp * 1000).toISOString() } as Transaction));
          
          setTransactions(prev => pageToFetch > 0 ? [...prev, ...searchResults] : searchResults);
          setTotalTransactions(nbHits);
          setCurrentPage(pageToFetch);
          setHasMore(pageToFetch + 1 < nbPages);
      } catch (error) {
          console.error("Algolia search error:", error);
          toast({ variant: "destructive", title: "Search Error", description: "Could not perform search." });
          setTransactions([]);
          setTotalTransactions(0);
          setHasMore(false);
      }
    } else {
      // --- FIRESTORE FETCH LOGIC ---
      setQueryID(null); // No search, so no queryID
      try {
        const collRef = collection(db, 'users', user.uid, 'transactions');
        const queryConstraints: QueryConstraint[] = [];
        
        if (filters.category) queryConstraints.push(where("category", "==", filters.category));
        if (filters.dateRange?.from) queryConstraints.push(where("date", ">=", filters.dateRange.from.toISOString()));
        if (filters.dateRange?.to) {
            const toDate = new Date(filters.dateRange.to);
            toDate.setHours(23, 59, 59, 999);
            queryConstraints.push(where("date", "<=", toDate.toISOString()));
        }
        if (filters.minAmount !== undefined) queryConstraints.push(where("amount", ">=", filters.minAmount));
        if (filters.maxAmount !== undefined) queryConstraints.push(where("amount", "<=", filters.maxAmount));
        
        if (pageToFetch === 0) {
            const countQuery = query(collRef, ...queryConstraints);
            const totalCountSnap = await getCountFromServer(countQuery);
            setTotalTransactions(totalCountSnap.data().count);
        }

        let q = query(collRef, ...queryConstraints, orderBy("date", "desc"), limit(TRANSACTIONS_PAGE_SIZE));
        
        if (pageToFetch > 0 && lastVisible) {
          q = query(q, startAfter(lastVisible));
        }
        
        const docsSnap = await getDocs(q);
        const docsData = docsSnap.docs.map(doc => doc.data() as Transaction);
        
        setHasMore(docsSnap.docs.length === TRANSACTIONS_PAGE_SIZE);
        setLastVisible(docsSnap.docs[docsSnap.docs.length - 1] || null);
        setCurrentPage(pageToFetch);
        setTransactions(prev => pageToFetch > 0 ? [...prev, ...docsData] : docsData);
      } catch (error: any) {
        console.error("Error fetching transactions:", error);
        if (error.message.includes('requires an index')) {
           toast({ variant: "destructive", title: "Filter Error", description: "This combination of filters requires a custom Firestore index. The functionality is not yet supported." });
        } else {
           toast({ variant: "destructive", title: "Error", description: "Could not retrieve transactions." });
        }
      }
    }
    setLoading(false);
  }, [user, debouncedDescription, searchIndex, filters, lastVisible, currentPage, toast]);
  
  useEffect(() => {
    // Reset pagination when filters change
    setCurrentPage(0);
    setLastVisible(null);
    fetchTransactions(false);
  // We only want this to run when these specific deps change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDescription, filters, user]);


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
    if (queryID) {
        const hit = transactions.find(t => t.id === transaction.id);
        if(hit) {
            const position = transactions.indexOf(hit) + 1;
            aa.clickedObjectIDsAfterSearch({
                index: algoliaIndexName,
                eventName: 'Transaction Edited',
                queryID: queryID,
                objectIDs: [transaction.id],
                positions: [position],
            });
        }
    }
    setSelectedTransaction(transaction);
    setIsSheetOpen(true);
  }, [queryID, transactions]);
  
  const handleSheetClose = useCallback((open: boolean) => {
    if (!open) {
      setSelectedTransaction(null);
    }
    setIsSheetOpen(open);
  }, []);
  
  const handleTransactionCreated = useCallback(async (values: any) => {
    await addTransaction({...values, date: values.date.toISOString()});
    await fetchTransactions(false); // Refetch from page 0
    toast({ title: "Transaction Added", description: "The transaction has been successfully created." });
  }, [addTransaction, fetchTransactions, toast]);

  const handleTransactionUpdated = useCallback(async (id: string, values: any) => {
    await updateTransaction(id, {...values, date: values.date.toISOString()});
    await fetchTransactions(false); // Refetch from page 0
    toast({ title: "Transaction Updated", description: "The transaction has been successfully updated." });
  }, [updateTransaction, fetchTransactions, toast]);


  const handleDelete = useCallback(async (id: string) => {
      try {
        await deleteTransaction(id);
        // Optimistically remove from UI
        setTransactions(prev => prev.filter(t => t.id !== id));
        setTotalTransactions(prev => prev - 1);
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
      fetchTransactions(true);
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
      const date = new Date(dateString);
       if (isNaN(date.getTime())) {
            return "Invalid Date"
        }
      return format(date, "MMMM d, yyyy");
    } catch {
      return 'Invalid date';
    }
  }, []);
  
  const isFiltering = descriptionFilter || categoryFilter !== 'all' || dateRange || minAmount || maxAmount;

  if (loading && transactions.length === 0) {
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
                ? `Found ${totalTransactions} transactions matching your filters.`
                : `Showing ${transactions.length} of ${totalTransactions} total transactions.`
              }
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
              {loading && transactions.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </TableCell>
                </TableRow>
              ) : transactions.length > 0 ? (
                transactions.map((transaction, index) => (
                  <TableRow key={transaction.id} className="cursor-pointer" onClick={() => handleEdit(transaction)}>
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
                    No transactions found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
          {hasMore && !loading && (
            <div className="flex justify-center mt-4">
              <Button 
                onClick={handleLoadMore} 
                variant="outline"
              >
                Load More
              </Button>
            </div>
          )}
           {loading && transactions.length > 0 && (
               <div className="flex justify-center mt-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
