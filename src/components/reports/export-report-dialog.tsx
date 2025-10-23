
"use client";

import { useState, useCallback } from "react";
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
import { Download } from "lucide-react";
import type { Transaction } from "@/types";
import { format } from "date-fns";

interface ExportReportDialogProps {
  transactions: Transaction[];
  dateRange?: { from: Date | undefined, to: Date | undefined };
}

export function ExportReportDialog({ transactions, dateRange }: ExportReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleExport = useCallback(() => {
    try {
      if (!transactions || transactions.length === 0) {
        toast({
          variant: "destructive",
          title: "No Data",
          description: "No transactions available to export for the selected period.",
        });
        return;
      }

      const exportData = transactions.map(transaction => ({
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
      link.setAttribute('download', `report-export-${format(new Date(), "yyyy-MM-dd")}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: `${exportData.length} transactions have been exported.`,
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "An error occurred while exporting the report.",
      });
    }
  }, [transactions, toast]);

  const dateRangeString = dateRange?.from && dateRange?.to 
    ? `${format(dateRange.from, 'PPP')} - ${format(dateRange.to, 'PPP')}` 
    : 'the selected period';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={transactions.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </DialogTrigger>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Export</DialogTitle>
              <DialogDescription>
                This will export {transactions.length} transactions for {dateRangeString} as a CSV file.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                 <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                 <Button onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                 </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
