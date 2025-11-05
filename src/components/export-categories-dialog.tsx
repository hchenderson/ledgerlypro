
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
import type { Category, SubCategory } from "@/types";
import { format } from "date-fns";

interface ExportCategoriesDialogProps {
  categories: Category[];
}

export function ExportCategoriesDialog({ categories }: ExportCategoriesDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleExport = useCallback(() => {
    try {
      if (!categories || categories.length === 0) {
        toast({
          variant: "destructive",
          title: "No Data",
          description: "No categories available to export.",
        });
        return;
      }

      const flattenedData: { name: string; type: string; parent_name: string }[] = [];
      const recurse = (cats: (Category | SubCategory)[], parentName = "", type = "expense") => {
        cats.forEach(c => {
          const currentType = (c as Category).type || type;
          flattenedData.push({ name: c.name, type: currentType, parent_name: parentName });
          if (c.subCategories) {
            recurse(c.subCategories, c.name, currentType);
          }
        });
      };
      
      recurse(categories);

      const csv = Papa.unparse(flattenedData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `categories-export-${format(new Date(), "yyyy-MM-dd")}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: `${flattenedData.length} categories have been exported.`,
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "An error occurred while exporting categories.",
      });
    }
  }, [categories, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Categories</DialogTitle>
          <DialogDescription>
            Export all your categories and sub-categories to a CSV file.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <p>This will create a CSV file with all of your category data, preserving the parent-child relationships. This file can be used as a backup or to import categories into another account.</p>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
