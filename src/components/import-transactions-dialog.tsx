
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

const REQUIRED_COLUMNS = ['amount', 'date', 'description'] as const;
type RequiredColumn = typeof REQUIRED_COLUMNS[number];


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
    return REQUIRED_COLUMNS.every(col => mapping[col] && headers.includes(mapping[col]));
  }, [mapping, headers])

  const processedTransactions = useMemo(() => {
    if (step !== "review" || !parsedData.length) return [];

    return parsedData
      .map((row) => {
        const amountStr = row[mapping.amount];
        const dateStr = row[mapping.date];
        const descriptionStr = row[mapping.description];

        if (!amountStr || !dateStr || !descriptionStr || descriptionStr.trim() === "") {
          return null;
        }
        
        // Sanitize amount string by removing currency symbols, commas, etc.
        const sanitizedAmountStr = amountStr.replace(/[^0-9.-]+/g,"");
        const amount = parseFloat(sanitizedAmountStr);
        const date = new Date(dateStr);

        if (
          isNaN(amount) ||
          isNaN(date.getTime())
        ) {
          return null; // Skip invalid rows
        }

        const type = amount >= 0 ? 'income' : 'expense';

        return {
          transaction: {
            amount: Math.abs(amount),
            date: date.toISOString(),
            description: descriptionStr,
            type: type,
            category: "Imported", // Default category
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
                Match the columns from your CSV to the required transaction fields. The transaction type will be determined automatically based on the amount.
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
                          <Badge variant={item.transaction.type === 'income' ? 'default' : 'secondary'} className={item.transaction.type === 'income' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700'}>
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
        <DialogContent className="sm:max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
            {renderContent()}
        </DialogContent>
    </Dialog>
  );
}

    
