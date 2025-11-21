
"use client";

import { useState, useCallback } from "react";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
import { Download, FileType } from "lucide-react";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";

interface ExportQuarterlyReportDialogProps {
  reportId: string;
  reportTitle: string;
}

export function ExportQuarterlyReportDialog({ reportId, reportTitle }: ExportQuarterlyReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  const handlePdfExport = useCallback(async () => {
    const reportElement = document.getElementById(reportId);
    if (!reportElement) {
      toast({
        variant: 'destructive',
        title: 'Export Error',
        description: 'Could not find the report element to export.',
      });
      return;
    }

    setIsLoading(true);

    try {
        const canvas = await html2canvas(reportElement, {
            scale: 2, // Higher resolution
            useCORS: true,
            allowTaint: true,
            logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        
        const safeTitle = reportTitle.replace(/\s+/g, '-').toLowerCase();
        pdf.save(`${safeTitle}-export-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
        toast({
            title: 'Export Successful',
            description: 'The report has been downloaded as a PDF.',
        });
        setIsOpen(false);
    } catch (error) {
        console.error('PDF Export error:', error);
        toast({
            variant: 'destructive',
            title: 'Export Failed',
            description: 'An error occurred while exporting the report as a PDF.',
        });
    } finally {
        setIsLoading(false);
    }
  }, [reportId, reportTitle, toast]);


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </DialogTrigger>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Quarterly Report</DialogTitle>
              <DialogDescription>
                This will generate a PDF of the report for {reportTitle}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="border rounded-md p-4 flex flex-col items-center justify-center gap-2">
                    <FileType className="h-8 w-8 text-red-500" />
                    <Label>PDF Document</Label>
                    <p className="text-xs text-muted-foreground text-center">Best for printing, sharing, and archiving.</p>
                </div>
            </div>
            <DialogFooter>
                 <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                 <Button onClick={handlePdfExport} disabled={isLoading}>
                    {isLoading ? "Exporting..." : "Export as PDF"}
                 </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
