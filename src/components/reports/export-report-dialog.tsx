
"use client";

import { useState, useCallback } from "react";
import html2canvas from 'html2canvas';
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
import { Download, Image as ImageIcon } from "lucide-react";
import type { Transaction } from "@/types";
import { format } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ExportReportDialogProps {
  transactions: Transaction[];
  dateRange?: { from: Date | undefined, to: Date | undefined };
  chartId?: string;
  chartTitle?: string;
}

export function ExportReportDialog({ transactions, dateRange, chartId, chartTitle = 'report' }: ExportReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'png'>('csv');
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  const handlePngExport = useCallback(async () => {
    if (!chartId) {
      toast({
        variant: 'destructive',
        title: 'Export Error',
        description: 'No chart is associated with this export button.',
      });
      return;
    }
    const chartElement = document.getElementById(chartId);
    if (!chartElement) {
      toast({
        variant: 'destructive',
        title: 'Export Error',
        description: 'Could not find the chart element to export.',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Temporarily add a class to ensure text is rendered correctly
      chartElement.classList.add('render-for-export');
      
      const canvas = await html2canvas(chartElement, {
        allowTaint: true,
        useCORS: true,
        backgroundColor: null, // Use transparent background, respects theme
        scale: 2, // Increase resolution
      });

      chartElement.classList.remove('render-for-export');

      const link = document.createElement('a');
      link.download = `${chartTitle.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast({
        title: 'Export Successful',
        description: 'The chart has been downloaded as a PNG image.',
      });
      setIsOpen(false);
    } catch (error) {
      console.error('PNG Export error:', error);
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'An error occurred while exporting the chart as a PNG.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [chartId, chartTitle, toast]);


  const handleCsvExport = useCallback(() => {
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
  }, [transactions, toast]);

  const handleExport = () => {
    if (exportFormat === 'png') {
        handlePngExport();
    } else {
        handleCsvExport();
    }
  }

  const dateRangeString = dateRange?.from && dateRange?.to 
    ? `${format(dateRange.from, 'PPP')} - ${format(dateRange.to, 'PPP')}` 
    : 'the selected period';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={transactions.length === 0 && !chartId}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </DialogTrigger>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Report</DialogTitle>
              <DialogDescription>
                Choose a format to export your report for {dateRangeString}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <Label>Export Format</Label>
                 <RadioGroup value={exportFormat} onValueChange={(value) => setExportFormat(value as 'csv' | 'png')} className="grid grid-cols-2 gap-4">
                    <Label htmlFor="export-csv" className={cn("border rounded-md p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent hover:text-accent-foreground", exportFormat === 'csv' && 'ring-2 ring-primary')}>
                        <Download className="h-8 w-8" />
                        <RadioGroupItem value="csv" id="export-csv" className="sr-only" />
                        <span className="font-semibold">CSV File</span>
                        <span className="text-xs text-muted-foreground text-center">Best for spreadsheets (Excel, Google Sheets)</span>
                    </Label>
                    <Label htmlFor="export-png" className={cn("border rounded-md p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent hover:text-accent-foreground", exportFormat === 'png' && 'ring-2 ring-primary', !chartId && 'opacity-50 cursor-not-allowed')}>
                        <ImageIcon className="h-8 w-8" />
                        <RadioGroupItem value="png" id="export-png" className="sr-only" disabled={!chartId}/>
                        <span className="font-semibold">PNG Image</span>
                        <span className="text-xs text-muted-foreground text-center">Best for presentations or sharing visuals</span>
                    </Label>
                </RadioGroup>
            </div>
            <DialogFooter>
                 <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                 <Button onClick={handleExport} disabled={isLoading || (exportFormat === 'png' && !chartId)}>
                    {isLoading ? "Exporting..." : "Export"}
                 </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
