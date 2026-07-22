"use client";

import { useMemo, useState } from "react";
import { format, getQuarter, getYear, subQuarters } from "date-fns";
import { Calendar as CalendarIcon, Loader2, PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUserData } from "@/hooks/use-user-data";
import { findCategoryPathById } from "@/lib/category-tree";

export function GenerateQuarterlyReportDialog({
  onGenerate,
}: {
  onGenerate: (
    referenceDate: Date,
    notes: string | undefined,
    budgetIds: string[]
  ) => boolean | Promise<boolean>;
}) {
  const { toast } = useToast();
  const { budgets, categories } = useUserData();
  const [isOpen, setIsOpen] = useState(false);
  const [referenceDate, setReferenceDate] = useState<Date | undefined>(
    subQuarters(new Date(), 1)
  );
  const [notes, setNotes] = useState<string>();
  const [selectedBudgetIds, setSelectedBudgetIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const budgetOptions = useMemo(
    () =>
      budgets
        .filter(
          (budget) =>
            referenceDate && budget.year === getYear(referenceDate)
        )
        .map((budget) => ({
          value: budget.id,
          label: `${
            findCategoryPathById(budget.categoryId, categories)
              ?.map((category) => category.name)
              .join(" > ") ?? "Unknown category"
          } (${budget.year})`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [budgets, categories, referenceDate]
  );

  const handleGenerate = async () => {
    if (!referenceDate) {
      toast({
        variant: "destructive",
        title: "Date Required",
        description: "Please select a reference date for the report.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const generated = await onGenerate(
        referenceDate,
        notes,
        selectedBudgetIds
      );
      if (!generated) return;
      setIsOpen(false);
      setNotes(undefined);
      setSelectedBudgetIds([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Quarterly Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Quarterly Report</DialogTitle>
          <DialogDescription>
            Select a date within the quarter you want to report on. You can also
            include specific budgets.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Reference Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {referenceDate ? format(referenceDate, "PPP") : "Select a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={referenceDate}
                  onSelect={(date) => {
                    setReferenceDate(date);
                    setSelectedBudgetIds([]);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {referenceDate && (
              <p className="text-sm text-muted-foreground">
                This will generate a report for{" "}
                <strong>
                  Q{getQuarter(referenceDate)} {getYear(referenceDate)}
                </strong>
                .
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>
              Budgets to Include ({referenceDate ? getYear(referenceDate) : 'select a year'})
            </Label>
            <SearchableMultiSelect
              options={budgetOptions}
              selected={selectedBudgetIds}
              onChange={setSelectedBudgetIds}
              placeholder="All matching-year budgets"
            />
            <p className="text-xs text-muted-foreground">
              Leave this empty to include every budget from the report year.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Add any notes or commentary for this report..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
              </>
            ) : (
              "Generate Report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
