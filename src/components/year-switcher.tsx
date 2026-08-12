
"use client";

import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "./ui/button";
import { Calendar, ChevronDown } from "lucide-react";
import { useComparison } from "@/hooks/use-comparison";
import { useAvailableTransactionYears } from "@/hooks/use-available-transaction-years";

export function YearSwitcher() {
  const { activeYear, setActiveYear } = useAuth();
  const { setComparisonYear } = useComparison();
  const { years, loading } = useAvailableTransactionYears();

  const currentSystemYear = new Date().getFullYear();
  
  const handleYearChange = (year: number) => {
    setActiveYear(year);
    setComparisonYear(undefined); // Clear comparison when active year changes
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-11 w-[112px] justify-start px-3 md:h-10 md:w-[180px] md:px-4"
          aria-label={`Select reporting year. Currently ${activeYear}`}
        >
          <Calendar className="mr-1.5 h-4 w-4 md:mr-2" />
          <span className="font-semibold">{activeYear}</span>
          {activeYear === currentSystemYear && (
            <span className="ml-auto hidden text-xs text-muted-foreground md:inline">Current</span>
          )}
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground md:hidden" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Select a Year</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <DropdownMenuItem disabled>Loading years…</DropdownMenuItem>
        ) : years.map((year) => (
          <DropdownMenuItem
            key={year}
            onSelect={() => handleYearChange(year)}
            className="min-h-11 md:min-h-0"
          >
            <span>{year}</span>
            {year === currentSystemYear && (
              <span className="ml-auto text-xs text-muted-foreground">Current</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
