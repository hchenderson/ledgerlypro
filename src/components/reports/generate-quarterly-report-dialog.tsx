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
import { useBudgets } from "@/hooks/use-budgets";
import { useCategories } from "@/hooks/use-categories";
import { findCategoryPathById } from "@/lib/category-tree";
import { useAccounts } from "@/hooks/use-accounts";

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
  const { budgets } = useBudgets();
  const { categories } = useCategories();
  const {
    accounts,
    selectedAccountIds,
    allAccountsSelected,
  } = useAccounts();
  const [isOpen, setIsOpen] = useState(false);
  const [referenceDate, setReferenceDate] = useState<Date | undefined>(
    subQuarters(new Date(), 1)
  );
  const [notes, setNotes] = useState<string>();
  const [selectedBudgetIds, setSelectedBudgetIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const accountScope = allAccountsSelected
    ? "All accounts"
    : selectedAccountIds
        .map(
          (accountId) =>
            accounts.find((account) => account.id === accountId)?.name,
        )
        .filter(Boolean)
        .join(", ");

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
        <Button aria-label="Generate a new quarterly report">
          <PlusCircle className="mr-2 h-4 w-4" />
          New Quarterly Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Quarterly Report</DialogTitle>
          <DialogDescription>
            Select a date within the quarter you want to report on. You can also
            include specific budgets. The report will use the current account
            filter.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2 sm:py-4">
          <div className="space-y-2">
            <Label htmlFor="quarterly-report-reference-date">Reference Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="quarterly-report-reference-date"
                  variant="outline"
                  className="w-full min-w-0 justify-start overflow-hidden text-left font-normal"
                  aria-label={`Reference date: ${referenceDate ? format(referenceDate, "PPP") : "not selected"}`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {referenceDate ? format(referenceDate, "PPP") : "Select a date"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto max-w-[calc(100vw-1rem)] overflow-x-auto p-0"
                align="center"
              >
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
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="font-medium">Account scope:</span>{" "}
              {accountScope || "Selected accounts"}
            </p>
          </div>
          <div
            className="space-y-2"
            role="group"
            aria-labelledby="quarterly-report-budgets-label"
          >
            <Label id="quarterly-report-budgets-label">
              Budgets to Include ({referenceDate ? getYear(referenceDate) : 'select a year'})
            </Label>
            <SearchableMultiSelect
              options={budgetOptions}
              selected={selectedBudgetIds}
              onChange={setSelectedBudgetIds}
              placeholder="All matching-year budgets"
            />
            <p className="text-xs text-muted-foreground">
              {selectedBudgetIds.length > 0
                ? `${selectedBudgetIds.length} budget${selectedBudgetIds.length === 1 ? "" : "s"} selected.`
                : "Leave this empty to include every budget from the report year."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quarterly-report-notes">Notes (Optional)</Label>
            <Textarea
              id="quarterly-report-notes"
              placeholder="Add any notes or commentary for this report..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleGenerate} disabled={isLoading} aria-busy={isLoading}>
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
