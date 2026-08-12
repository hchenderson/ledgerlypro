
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
import { Download, FileText, Table2 } from "lucide-react";
import type { Transaction } from "@/types";
import { format } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAccounts } from "@/hooks/use-accounts";
import {
  generateReportPdf,
  type ReportPdfData,
  type ReportPdfMode,
} from "@/lib/report-pdf";

interface ExportReportDialogProps {
  transactions: Transaction[];
  dateRange?: { from?: Date, to?: Date };
  chartId?: string;
  chartTitle?: string;
  pdfReport?: Omit<ReportPdfData, "transactions" | "accountName">;
}

export function ExportReportDialog({ transactions, dateRange, chartId, chartTitle = 'report', pdfReport }: ExportReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('pdf');
  const [pdfMode, setPdfMode] = useState<ReportPdfMode>('summary');
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();
  const { getAccountName } = useAccounts();

  const handlePdfExport = useCallback(async () => {
    setIsLoading(true);
    try {
      const fallbackReport: Omit<ReportPdfData, "transactions" | "accountName"> = {
        title: chartTitle,
        dateRange: dateRange?.from && dateRange?.to
          ? `${format(dateRange.from, "PPP")} - ${format(dateRange.to, "PPP")}`
          : "Selected reporting period",
        generatedAt: format(new Date(), "PPP p"),
        metadata: [],
        metrics: [],
        insights: [],
        tables: [],
        chartElementIds: chartId ? [chartId] : [],
      };
      await generateReportPdf(
        {
          ...(pdfReport ?? fallbackReport),
          transactions,
          accountName: getAccountName,
        },
        pdfMode,
      );
      toast({
        title: "PDF exported",
        description: `${pdfMode === "summary" ? "Summary" : "Detailed"} report downloaded successfully.`,
      });
      setIsOpen(false);
    } catch (error) {
      console.error("PDF export error:", error);
      toast({
        variant: "destructive",
        title: "PDF export failed",
        description: "The report could not be generated. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [chartId, chartTitle, dateRange, getAccountName, pdfMode, pdfReport, transactions, toast]);


  const handleCsvExport = useCallback(async () => {
    if (!transactions || transactions.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "No transactions available to export for the selected period.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { default: Papa } = await import("papaparse");
      const exportData = transactions.map(transaction => ({
        Date: transaction.date ? format(new Date(transaction.date), "yyyy-MM-dd") : '',
        Description: transaction.description || '',
        Account: getAccountName(transaction.accountId),
        Category: transaction.category || '',
        Type: transaction.type || '',
        Direction:
          transaction.type === "transfer"
            ? transaction.transferDirection ?? ""
            : "",
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
      console.error('CSV Export error:', error);
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'An error occurred while exporting the report as a CSV file.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [getAccountName, transactions, toast]);

  const handleExport = async () => {
    if (exportFormat === 'pdf') {
        await handlePdfExport();
    } else {
        await handleCsvExport();
    }
  }

  const dateRangeString = dateRange?.from && dateRange?.to 
    ? `${format(dateRange.from, 'PPP')} - ${format(dateRange.to, 'PPP')}` 
    : 'the selected period';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={transactions.length === 0 && !chartId}
            aria-label={`Export ${chartTitle}`}
          >
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Export Report</DialogTitle>
              <DialogDescription>
                Choose a format to export your report for {dateRangeString}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 sm:py-4">
                <Label id="export-format-label">Export Format</Label>
                 <RadioGroup
                   value={exportFormat}
                   onValueChange={(value) => setExportFormat(value as 'csv' | 'pdf')}
                   className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 sm:gap-4"
                   aria-labelledby="export-format-label"
                 >
                    <Label htmlFor="export-csv" className={cn("flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border p-4 text-center hover:bg-accent hover:text-accent-foreground", exportFormat === 'csv' && 'ring-2 ring-primary')}>
                        <Download className="h-8 w-8" />
                        <RadioGroupItem value="csv" id="export-csv" className="sr-only" />
                        <span className="font-semibold">CSV File</span>
                        <span className="text-xs text-muted-foreground text-center">Best for spreadsheets (Excel, Google Sheets)</span>
                    </Label>
                    <Label htmlFor="export-pdf" className={cn("flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border p-4 text-center hover:bg-accent hover:text-accent-foreground", exportFormat === 'pdf' && 'ring-2 ring-primary')}>
                        <FileText className="h-8 w-8" />
                        <RadioGroupItem value="pdf" id="export-pdf" className="sr-only" />
                        <span className="font-semibold">PDF Document</span>
                        <span className="text-xs text-muted-foreground text-center">Print-ready pages with selectable text and tables</span>
                    </Label>
                </RadioGroup>
                {exportFormat === "pdf" ? (
                  <div className="space-y-2">
                    <Label id="pdf-detail-label">PDF detail</Label>
                    <RadioGroup
                      value={pdfMode}
                      onValueChange={(value) => setPdfMode(value as ReportPdfMode)}
                      className="grid gap-3 sm:grid-cols-2"
                      aria-labelledby="pdf-detail-label"
                    >
                      <Label htmlFor="pdf-summary" className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-4", pdfMode === "summary" && "ring-2 ring-primary")}>
                        <FileText className="mt-0.5 h-5 w-5 shrink-0" />
                        <span><RadioGroupItem value="summary" id="pdf-summary" className="sr-only" /><span className="block font-semibold">Summary</span><span className="mt-1 block text-xs text-muted-foreground">Key metrics, insights, and high-level tables</span></span>
                      </Label>
                      <Label htmlFor="pdf-detailed" className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-4", pdfMode === "detailed" && "ring-2 ring-primary")}>
                        <Table2 className="mt-0.5 h-5 w-5 shrink-0" />
                        <span><RadioGroupItem value="detailed" id="pdf-detailed" className="sr-only" /><span className="block font-semibold">Detailed</span><span className="mt-1 block text-xs text-muted-foreground">All tables, charts, and filtered transactions</span></span>
                      </Label>
                    </RadioGroup>
                  </div>
                ) : null}
            </div>
            <DialogFooter>
                 <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                 <Button onClick={handleExport} disabled={isLoading} aria-busy={isLoading}>
                    {isLoading ? "Exporting..." : "Export"}
                 </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
