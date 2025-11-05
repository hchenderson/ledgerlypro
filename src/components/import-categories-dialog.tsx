
"use client";

import { useState } from "react";
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
import { Upload, FileUp, Loader2 } from "lucide-react";

interface ImportCategoriesDialogProps {
  onImport: (data: { name: string; type: 'income' | 'expense'; parent_name: string }[]) => void;
}

export function ImportCategoriesDialog({ onImport }: ImportCategoriesDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const resetState = () => {
    setFile(null);
    setIsLoading(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    setIsOpen(open);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
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

        const requiredHeaders = ['name', 'type'];
        const hasHeaders = requiredHeaders.every(h => results.meta.fields?.includes(h));
        if (!hasHeaders) {
            toast({
                variant: 'destructive',
                title: 'Invalid CSV format',
                description: 'File must contain "name" and "type" columns.'
            });
            setIsLoading(false);
            return;
        }
        
        // Normalize data, parent_name is optional
        const data = (results.data as any[]).map(row => ({
            name: row.name,
            type: row.type === 'income' ? 'income' : 'expense',
            parent_name: row.parent_name || ''
        }));

        onImport(data);
        handleClose(false);
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Categories</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk-add categories. The file must contain columns: `name`, `type`, and optionally `parent_name`.
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
            <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
          </label>
          {file && <p className="mt-2 text-sm text-center text-muted-foreground">{file.name}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleImport} disabled={!file || isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Importing..." : "Import & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
