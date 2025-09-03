
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

type ImportStep = "upload" | "mapping" | "review";

const REQUIRED_COLUMNS = ['amount', 'date', 'description'] as const;
type RequiredColumn = typeof REQUIRED_COLUMNS[number];

const transactionTypeOptions = ["income", "expense"] as const;

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
  const [mapping, setMapping] = useState<Record<RequiredColumn, string>>({
    amount: "",
    date: "",
    description: "",
  });
  const [transactionType, setTransactionType] = useState<(typeof transactionTypeOptions)[number]>('expense');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const resetState = () => {
    setStep("upload");
    setFile(null);
    setParsedData([]);
    setHeaders([]);
    setMapping({ amount: "", date: "", description: "" });
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
    return REQUIRED_COLUMNS.every(col => mapping[col] && headers.includes(mapping[col]));
  }, [mapping, headers])

  const processedTransactions = useMemo(() => {
    if (step !== "review") return [];

    return parsedData.map((row, index) => {
        let hasError = false;
        let errorMessages: string[] = [];

        const amount = parseFloat(row[mapping.amount]);
        if(isNaN(amount) || amount <= 0) {
            hasError = true;
            errorMessages.push("Invalid amount");
        }

        const date = new Date(row[mapping.date]);
        if (isNaN(date.getTime())) {
            hasError = true;
            errorMessages.push("Invalid date");
        }
        
        const description = row[mapping.description];
        if(!description || description.trim() === '') {
            hasError = true;
            errorMessages.push("Missing description");
        }

        return {
            originalRow: row,
            transaction: {
                amount,
                date: date.toISOString(),
                description,
                type: transactionType,
                category: 'Imported' // Default category
            },
            hasError,
            errorMessages
        };
    }).filter(item => !item.hasError);
  }, [step, parsedData, mapping, transactionType]);


  const handleImport = () => {
    if(processedTransactions.length === 0) {
        toast({ variant: "destructive", title: "No valid transactions to import." });
        return;
    }
    
    const transactionsToImport = processedTransactions.map(item => item.transaction);
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
            <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {REQUIRED_COLUMNS.map(col => (
                    <div key={col} className="space-y-2">
                        <Label className="capitalize">{col}</Label>
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
                <div className="space-y-2">
                  <Label>Transaction Type</Label>
                  <Select value={transactionType} onValueChange={(v: any) => setTransactionType(v)}>
                      <SelectTrigger>
                          <SelectValue placeholder="Select transaction type" />
                      </SelectTrigger>
                      <SelectContent>
                          {transactionTypeOptions.map(type => (
                            <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Apply this type to all imported transactions.</p>
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
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedTransactions.slice(0, 100).map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{new Date(item.transaction.date).toLocaleDateString()}</TableCell>
                        <TableCell>{item.transaction.description}</TableCell>
                        <TableCell className={cn("text-right font-code", transactionType === 'income' && 'text-emerald-600')}>
                          {transactionType === 'income' ? '+' : '-'}
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
        <DialogContent className="sm:max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
            {renderContent()}
        </DialogContent>
    </Dialog>
  );
}
