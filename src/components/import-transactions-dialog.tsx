
"use client";

import { useState, useMemo, type ReactNode } from "react";
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
import { ArrowRight, FileUp, Loader2, Upload } from "lucide-react";
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
import type { Transaction } from "@/types";
import { Badge } from "./ui/badge";

type ImportStep = "upload" | "mapping" | "review";

const REQUIRED_COLUMNS = ['date', 'description'] as const;
type RequiredColumn = typeof REQUIRED_COLUMNS[number];
const AMOUNT_COLUMNS = ['amount', 'credit', 'debit'] as const;
type AmountColumn = typeof AMOUNT_COLUMNS[number];
const OPTIONAL_COLUMNS = ['category'] as const;
type OptionalColumn = typeof OPTIONAL_COLUMNS[number];


interface ImportTransactionsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onTransactionsImported: (transactions: Omit<Transaction, 'id'>[]) => void;
  children: ReactNode;
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
  const [mapping, setMapping] = useState<Record<RequiredColumn | AmountColumn | OptionalColumn, string>>({
    date: "",
    description: "",
    amount: "",
    credit: "",
    debit: "",
    category: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const resetState = () => {
    setStep("upload");
    setFile(null);
    setParsedData([]);
    setHeaders([]);
    setMapping({ date: "", description: "", amount: "", credit: "", debit: "", category: "" });
    setIsLoading(false);
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
        setHeaders(results.meta.fields || []);
        setParsedData(results.data as Record<string, string>[]);
        setStep("mapping");
        setIsLoading(false);
      },
    });
  };
  
  const canProceedToReview = useMemo(() => {
    const hasRequired = REQUIRED_COLUMNS.every(col => mapping[col] && headers.includes(mapping[col]));
    const hasAmount = mapping.amount || (mapping.credit && mapping.debit);
    return hasRequired && hasAmount;
  }, [mapping, headers])

  const processedTransactions = useMemo(() => {
    if (step !== "review" || !parsedData.length) return [];

    return parsedData
      .map((row) => {
        const dateStr = row[mapping.date];
        const descriptionStr = row[mapping.description];

        if (!dateStr || !descriptionStr || descriptionStr.trim() === "") {
          return null;
        }
        
        let amount = 0;
        let type: 'income' | 'expense' | null = null;
        
        if(mapping.amount) {
            const sanitizedAmountStr = (row[mapping.amount] || "").replace(/[^0-9.-]+/g,"");
            const parsedAmount = parseFloat(sanitizedAmountStr);
            if(!isNaN(parsedAmount)) {
                amount = Math.abs(parsedAmount);
                type = parsedAmount >= 0 ? 'income' : 'expense';
            }
        } else if (mapping.credit && mapping.debit) {
             const creditStr = (row[mapping.credit] || "").replace(/[^0-9.-]+/g,"");
             const debitStr = (row[mapping.debit] || "").replace(/[^0-9.-]+/g,"");
             const creditAmount = parseFloat(creditStr);
             const debitAmount = parseFloat(debitStr);

             if(!isNaN(creditAmount) && creditAmount > 0) {
                 amount = creditAmount;
                 type = 'income';
             } else if (!isNaN(debitAmount) && debitAmount > 0) {
                 amount = debitAmount;
                 type = 'expense';
             }
        }

        const date = new Date(dateStr);

        if (
          !type ||
          amount === 0 ||
          isNaN(date.getTime())
        ) {
          return null; // Skip invalid rows
        }

        return {
          transaction: {
            amount,
            date: date.toISOString(),
            description: descriptionStr,
            type: type,
            category: row[mapping.category] || "Imported", // Use mapped category or default
          },
        };
      })
      .filter(Boolean) as { transaction: Omit<Transaction, "id"> }[];
  }, [step, parsedData, mapping]);


  const handleImport = () => {
    if(processedTransactions.length === 0) {
        toast({ variant: "destructive", title: "No valid transactions to import." });
        return;
    }
    
    const transactionsToImport = processedTransactions.map(item => item.transaction as Omit<Transaction, 'id'>);
    onTransactionsImported(transactionsToImport);
    
    toast({
        title: "Import Successful",
        description: `${transactionsToImport.length} transactions have been added.`,
    });
    handleClose(false);
  }

  const renderContent = () => {
    switch (step) {
      case "upload":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Step 1: Upload CSV</DialogTitle>
              <DialogDescription>
                Select a CSV file with your transactions. Make sure it has
                columns for date, description, and amount.
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
                     {REQUIRED_COLUMNS.map(col => (
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
                <div>
                    <p className="text-sm text-muted-foreground mb-2">
                        For amounts, map a single column (positive for income, negative for expense) OR map separate credit/debit columns.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded-md">
                        {['amount'].map(col => (
                            <div key={col} className="space-y-2">
                                <Label className="capitalize">{col}</Label>
                                <Select onValueChange={(value) => setMapping(prev => ({...prev, [col]: value, credit: '', debit: ''}))} disabled={!!(mapping.credit || mapping.debit)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select column" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {headers.map(header => (<SelectItem key={header} value={header}>{header}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                        <div className="flex items-center justify-center text-muted-foreground text-sm">OR</div>
                         <div className="grid grid-cols-2 gap-2 col-span-1">
                             {['credit', 'debit'].map(col => (
                                <div key={col} className="space-y-2">
                                    <Label className="capitalize">{col}</Label>
                                    <Select onValueChange={(value) => setMapping(prev => ({...prev, [col]: value, amount: ''}))} disabled={!!mapping.amount}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select column" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {headers.map(header => (<SelectItem key={header} value={header}>{header}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
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
                         <TableCell><Badge variant="outline">{item.transaction.category}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={item.transaction.type === 'income' ? 'default' : 'secondary'} className={cn(item.transaction.type === 'income' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700', 'border-none')}>
                              {item.transaction.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn("text-right font-code", item.transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600')}>
                          {item.transaction.type === 'income' ? '+' : '-'}
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.transaction.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedData.length > 100 && <p className="text-xs text-center text-muted-foreground mt-2">Showing first 100 of {processedTransactions.length} valid transactions.</p>}
            </div>
            <DialogFooter>
                 <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
                 <Button onClick={handleImport} disabled={processedTransactions.length === 0}>
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

    
