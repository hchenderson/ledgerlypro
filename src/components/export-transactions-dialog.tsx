
"use client";

import { useState, useMemo, type ReactNode, useCallback } from "react";
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
import { Calendar as CalendarIcon, Download, X } from "lucide-react";
import { Label } from "./ui/label";
import type { Transaction, Category, SubCategory } from "@/types";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Input } from "./ui/input";
import { MultiSelect } from "./ui/multi-select";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

interface ExportTransactionsDialogProps {
  transactions: Transaction[];
  categories: Category[];
  triggerButton: ReactNode;
}

export function ExportTransactionsDialog({
  transactions,
  categories,
  triggerButton,
}: ExportTransactionsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportType, setExportType] = useState<"all" | "filtered">("all");
  
  // Filter states
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const { toast } = useToast();

  const resetState = () => {
    setDateRange(undefined);
    setSelectedCategories([]);
    setMinAmount("");
    setMaxAmount("");
    setExportType("all");
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    setIsOpen(open);
  };
  
  const allCategoryOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const recurse = (cats: (Category | SubCategory)[]) => {
      cats.forEach(c => {
        options.push({ value: c.name, label: c.name });
        if(c.subCategories) recurse(c.subCategories);
      });
    };
    recurse(categories);
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [categories]);

  const filteredTransactions = useMemo(() => {
    if (exportType === "all") return transactions;

    const getSubCategoryNames = (category: Category | SubCategory): string[] => {
        let names = [category.name];
        if (category.subCategories) {
            category.subCategories.forEach(sub => {
                names = [...names, ...getSubCategoryNames(sub)];
            });
        }
        return names;
    };

    const findCategoryByName = (name: string, cats: (Category|SubCategory)[]): Category | SubCategory | undefined => {
        for (const cat of cats) {
            if (cat.name === name) return cat;
            if (cat.subCategories) {
                const found = findCategoryByName(name, cat.subCategories);
                if (found) return found;
            }
        }
        return undefined;
    };

    let finalCategoryFilter: string[] = [];
    if (selectedCategories.length > 0) {
      selectedCategories.forEach(catName => {
        const mainCategory = findCategoryByName(catName, categories);
        if(mainCategory) {
          finalCategoryFilter.push(...getSubCategoryNames(mainCategory));
        } else {
          finalCategoryFilter.push(catName);
        }
      });
      finalCategoryFilter = [...new Set(finalCategoryFilter)]; // Remove duplicates
    }


    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      const inDateRange = dateRange?.from && dateRange?.to ? 
        (transactionDate >= dateRange.from && transactionDate <= dateRange.to) : true;
      
      const inCategory = finalCategoryFilter.length > 0 ? finalCategoryFilter.includes(t.category) : true;
      
      const min = minAmount ? parseFloat(minAmount) : -Infinity;
      const max = maxAmount ? parseFloat(maxAmount) : Infinity;
      const inAmountRange = t.amount >= min && t.amount <= max;

      return inDateRange && inCategory && inAmountRange;
    });
  }, [transactions, exportType, dateRange, selectedCategories, minAmount, maxAmount, categories]);

  const handleExport = useCallback(() => {
    try {
      if (!filteredTransactions || filteredTransactions.length === 0) {
        toast({
          variant: "destructive",
          title: "No Data",
          description: "No transactions available to export with the selected filters.",
        });
        return;
      }

      const exportData = filteredTransactions.map(transaction => ({
        Date: transaction.date ? format(new Date(transaction.date), "yyyy-MM-dd") : '',
        Description: transaction.description || '',
        Category: transaction.category || '',
        Type: transaction.type || '',
        Amount: transaction.amount || 0,
      }));

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions-export-${format(new Date(), "yyyy-MM-dd")}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: `${exportData.length} transactions have been exported.`,
      });
      handleClose(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "An error occurred while exporting transactions.",
      });
    }
  }, [filteredTransactions, toast]);


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogTrigger asChild>{triggerButton}</DialogTrigger>
        <DialogContent className="sm:max-w-xl" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Export Transactions</DialogTitle>
              <DialogDescription>
                Choose to export all transactions or apply filters for a more specific set of data.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <RadioGroup value={exportType} onValueChange={(val) => setExportType(val as "all" | "filtered")} className="flex space-x-4">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all" id="all" />
                        <Label htmlFor="all">Export all transactions</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="filtered" id="filtered" />
                        <Label htmlFor="filtered">Apply filters</Label>
                    </div>
                </RadioGroup>

                {exportType === 'filtered' && (
                    <div className="border p-4 rounded-md space-y-4 animate-in fade-in-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="flex flex-col gap-2">
                                <Label>Date Range</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn(
                                        "w-full justify-start text-left font-normal",
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
                                        <span>Pick a date</span>
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
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label>Amount Range</Label>
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
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label>Categories</Label>
                            <MultiSelect
                                options={allCategoryOptions}
                                selected={selectedCategories}
                                onChange={setSelectedCategories}
                                placeholder="All categories"
                            />
                        </div>
                    </div>
                )}
            </div>
            <DialogFooter>
                 <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                 <Button onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export {filteredTransactions.length} Transactions
                 </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
