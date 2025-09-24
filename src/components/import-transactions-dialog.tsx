

"use client";

import { useState, useMemo, type ReactNode, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { ArrowRight, FileUp, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "./ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { cn } from "@/lib/utils";
import type { Transaction, Category, SubCategory } from "@/types";
import { Badge } from "./ui/badge";
import { useUserData } from "@/hooks/use-user-data";

type ImportStep = "upload" | "mapping" | "review";

const REQUIRED_COLUMNS = ['date', 'description', 'credit', 'debit'] as const;
type RequiredColumn = typeof REQUIRED_COLUMNS[number];
const OPTIONAL_COLUMNS = ['category'] as const;
type OptionalColumn = typeof OPTIONAL_COLUMNS[number];


interface ImportTransactionsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onTransactionsImported: (transactions: Omit<Transaction, 'id'>[]) => void;
  children: ReactNode;
}

type ProcessedTransaction = {
    transaction: Omit<Transaction, 'id'>
}

export function ImportTransactionsDialog({
  isOpen,
  onOpenChange,
  onTransactionsImported,
  children,
}: ImportTransactionsDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<RequiredColumn | OptionalColumn, string>>({
    date: "",
    description: "",
    credit: "",
    debit: "",
    category: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [processedTransactions, setProcessedTransactions] = useState<ProcessedTransaction[]>([]);

  const { toast } = useToast();
  const { categories, addCategory } = useUserData();

  const resetState = () => {
    setStep("upload");
    setFile(null);
    setParsedData([]);
    setHeaders([]);
    setMapping({ date: "", description: "", credit: "", debit: "", category: "" });
    setIsLoading(false);
    setProcessedTransactions([]);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) {
      toast({ variant: "destructive", title: "No file selected." });
      return;
    }
    setIsLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', '\t', ';'],
      complete: (results) => {
        if (results.errors.length) {
          toast({
            variant: "destructive",
            title: "Error parsing CSV",
            description: results.errors[0].message,
          });
          setIsLoading(false);
          return;
        }
        setHeaders((results.meta.fields || []).filter(Boolean));
        setParsedData(results.data as Record<string, string>[]);
        setStep("mapping");
        setIsLoading(false);
      },
    });
  };
  
  const canProceedToReview = useMemo(() => {
    return REQUIRED_COLUMNS.every(col => mapping[col] && headers.includes(mapping[col]));
  }, [mapping, headers]);

  const allCategoryNames = useMemo(() => {
      const names = new Set<string>();
      const recursiveAdd = (cats: (Category | SubCategory)[]) => {
          cats.forEach(cat => {
              names.add(cat.name);
              if (cat.subCategories) {
                  recursiveAdd(cat.subCategories);
              }
          })
      }
      recursiveAdd(categories);
      return names;
  }, [categories]);

  useEffect(() => {
    if (step !== "review") return;

    const processAndSetTransactions = async () => {
        let uncategorizedExists = allCategoryNames.has("Uncategorized");
        if (!uncategorizedExists) {
            // Check again in case it was just added in another async operation
            const currentCats = categories;
            if (!currentCats.some(c => c.name === 'Uncategorized' && c.type === 'expense')) {
                await addCategory({
                    name: 'Uncategorized',
                    type: 'expense',
                    icon: 'HelpCircle'
                });
                allCategoryNames.add("Uncategorized");
            }
        }
    
        const transactions = parsedData
          .map((row, index) => {
            const dateStr = row[mapping.date];
            const descriptionStr = row[mapping.description];

            console.log(`Row ${index}:`, {
              date: dateStr,
              description: descriptionStr,
              credit: row[mapping.credit],
              debit: row[mapping.debit],
            });

            if (!dateStr || !descriptionStr || descriptionStr.trim() === "") {
              console.log(`Skipping row ${index}: missing date or description`);
              return null;
            }
            
            let amountVal: number | null = null;
            let type: 'income' | 'expense' | null = null;
            
            // Clean the strings more thoroughly
            const creditStr = (row[mapping.credit] || "").toString().trim();
            const debitStr = (row[mapping.debit] || "").toString().trim();
            
            console.log(`Row ${index} cleaned strings:`, { creditStr, debitStr });
            
            // Remove currency symbols, commas, and other non-numeric characters except decimal points and minus signs
            const creditCleaned = creditStr.replace(/[$,\s]/g, '').replace(/[^0-9.-]/g, '');
            const debitCleaned = debitStr.replace(/[$,\s]/g, '').replace(/[^0-9.-]/g, '');
            
            const creditAmount = creditCleaned === '' ? 0 : parseFloat(creditCleaned);
            const debitAmount = debitCleaned === '' ? 0 : parseFloat(debitCleaned);
            
            console.log(`Row ${index} parsed amounts:`, { creditAmount, debitAmount });

            // Handle different scenarios
            if (!isNaN(creditAmount) && creditAmount > 0) {
              type = 'income';
              amountVal = Math.abs(creditAmount); // Ensure positive
            } else if (!isNaN(debitAmount) && debitAmount > 0) {
              type = 'expense';
              amountVal = Math.abs(debitAmount); // Ensure positive
            } else if (!isNaN(debitAmount) && debitAmount < 0) {
              // Handle negative values in debit column (some CSVs use negative for expenses)
              type = 'expense';
              amountVal = Math.abs(debitAmount);
            } else if (!isNaN(creditAmount) && creditAmount < 0) {
              // Handle negative values in credit column
              type = 'expense';
              amountVal = Math.abs(creditAmount);
            } else {
              console.log(`Row ${index}: No valid amount found`);
              return null;
            }
            
            if (type === null || amountVal === null || amountVal === 0) {
              console.log(`Row ${index}: Invalid type or amount`);
              return null;
            }

            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              console.log(`Row ${index}: Invalid date`);
              return null;
            }
            
            const importedCategory = row[mapping.category] || "";
            const finalCategory = allCategoryNames.has(importedCategory) ? importedCategory : "Uncategorized";

            const transaction = {
              amount: amountVal,
              date: date.toISOString(),
              description: descriptionStr,
              type: type,
              category: finalCategory,
            };

            console.log(`Row ${index} final transaction:`, transaction);
            
            return {
              transaction,
            };
          })
          .filter(Boolean) as ProcessedTransaction[];

        console.log('Total processed transactions:', transactions.length);
        setProcessedTransactions(transactions);
    }

    processAndSetTransactions();

  }, [step, parsedData, mapping, allCategoryNames, categories, addCategory]);


  const handleImport = () => {
    const transactionsWithCategory = processedTransactions.filter(item => item.transaction.category);
    if(transactionsWithCategory.length === 0) {
        toast({ variant: "destructive", title: "No valid transactions to import.", description: "Please ensure at least one transaction has a category selected." });
        return;
    }
    
    const transactionsToImport = transactionsWithCategory.map(item => item.transaction as Omit<Transaction, 'id'>);
    onTransactionsImported(transactionsToImport);
    
    toast({
        title: "Import Successful",
        description: `${transactionsToImport.length} transactions have been added.`,
    });
    handleClose(false);
  }

  const handleCategoryChange = (index: number, newCategory: string) => {
    setProcessedTransactions(current => {
      const newTransactions = [...current];
      newTransactions[index].transaction.category = newCategory;
      return newTransactions;
    })
  }
  
  const availableCategories = useMemo(() => {
    const incomeCats = new Set<string>();
    const expenseCats = new Set<string>();
    const processCats = (cats: (Category | SubCategory)[], type: 'income' | 'expense') => {
        cats.forEach(c => {
            const targetSet = (c as Category).type === 'income' || type === 'income' ? incomeCats : expenseCats;
            if(c.name) targetSet.add(c.name);
            if (c.subCategories) {
                processCats(c.subCategories, (c as Category).type || type);
            }
        });
    };
    processCats(categories.filter(c => c.type === 'income'), 'income');
    processCats(categories.filter(c => c.type === 'expense'), 'expense');

    return { 
        income: Array.from(incomeCats).filter(Boolean), 
        expense: Array.from(expenseCats).filter(Boolean) 
    };
  }, [categories]);

  const renderContent = () => {
    switch (step) {
      case "upload":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Step 1: Upload CSV</DialogTitle>
              <DialogDescription>
                Select a CSV file with your transactions. Make sure it has columns for date, description, credit (income), and debit (expense).
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileUp className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">CSV (MAX. 5MB)</p>
                </div>
                <input type="file" className="hidden" accept=".csv" onChange={handleFileChange}/>
              </label>
              {file && <p className="mt-2 text-sm text-center text-muted-foreground">{file.name}</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleUpload} disabled={!file || isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upload & Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        );
      case "mapping":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Step 2: Map Columns</DialogTitle>
              <DialogDescription>
                Match the columns from your CSV to the required transaction fields.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                     {['date', 'description'].map(col => (
                        <div key={col} className="space-y-2">
                            <Label className="capitalize">{col} <span className="text-destructive">*</span></Label>
                            <Select onValueChange={(value) => setMapping(prev => ({...prev, [col]: value}))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select CSV column" />
                                </SelectTrigger>
                                <SelectContent>
                                    {headers.map(header => (
                                        <SelectItem key={header} value={header}>{header}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </div>
                <div className="border p-4 rounded-md space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Provide separate columns for your income (credit) and expenses (debit).
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label>Credit (Income) <span className="text-destructive">*</span></Label>
                            <Select onValueChange={(value) => setMapping(prev => ({...prev, credit: value}))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select credit column" />
                                </SelectTrigger>
                                <SelectContent>
                                    {headers.map(header => (<SelectItem key={header} value={header}>{header}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Debit (Expense) <span className="text-destructive">*</span></Label>
                            <Select onValueChange={(value) => setMapping(prev => ({...prev, debit: value}))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select debit column" />
                                </SelectTrigger>
                                <SelectContent>
                                    {headers.map(header => (<SelectItem key={header} value={header}>{header}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <div>
                     <Label>Category (Optional)</Label>
                      <Select onValueChange={(value) => setMapping(prev => ({...prev, category: value}))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select category column" />
                        </SelectTrigger>
                        <SelectContent>
                            {headers.map(header => (
                                <SelectItem key={header} value={header}>{header}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
                <Button onClick={() => setStep('review')} disabled={!canProceedToReview}>
                    Review Data
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </DialogFooter>
          </>
        );
        case "review":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Step 3: Review & Confirm</DialogTitle>
              <DialogDescription>
                Review the transactions to be imported. Invalid rows have been skipped. Found {processedTransactions.length} valid rows.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="h-64 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-secondary">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                       <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedTransactions.slice(0, 100).map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{new Date(item.transaction.date).toLocaleDateString()}</TableCell>
                        <TableCell>{item.transaction.description}</TableCell>
                         <TableCell>
                           <Select 
                              value={item.transaction.category} 
                              onValueChange={(value) => handleCategoryChange(index, value)}
                            >
                                <SelectTrigger className="w-[180px] h-8">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(item.transaction.type === 'income' ? availableCategories.income : availableCategories.expense).map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         </TableCell>
                        <TableCell>
                          <Badge variant={item.transaction.type === 'income' ? 'default' : 'secondary'} className={cn(item.transaction.type === 'income' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700', 'border-none')}>
                              {item.transaction.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn("text-right font-code", item.transaction.type === 'income' ? 'text-emerald-600' : 'text-foreground')}>
                          {item.transaction.type === 'income' ? '+' : '-'}
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.transaction.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedData.length > 100 && <p className="text-xs text-center text-muted-foreground mt-2">Showing a preview of the first 100 of {processedTransactions.length} valid transactions. All will be imported.</p>}
            </div>
            <DialogFooter>
                 <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
                 <Button onClick={handleImport} disabled={processedTransactions.filter(item => item.transaction.category).length === 0}>
                    Confirm & Import
                 </Button>
            </DialogFooter>
          </>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-3xl" onInteractOutside={(e) => e.preventDefault()}>
            {renderContent()}
        </DialogContent>
    </Dialog>
  );
}
