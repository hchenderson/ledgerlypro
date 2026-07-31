
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
import { Calendar } from "lucide-react";
import { useComparison } from "@/hooks/use-comparison";
import { useMemo } from "react";

export function YearSwitcher() {
  const { activeYear, setActiveYear, firstYear } = useAuth();
  const { setComparisonYear } = useComparison();

  const currentSystemYear = new Date().getFullYear();
  
  const years = useMemo(() => {
    const oldestYear = Math.min(firstYear, currentSystemYear);
    return Array.from(
      { length: currentSystemYear - oldestYear + 1 },
      (_, index) => currentSystemYear - index,
    );
  }, [currentSystemYear, firstYear]);


  const handleYearChange = (year: number) => {
    setActiveYear(year);
    setComparisonYear(undefined); // Clear comparison when active year changes
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-11 w-[92px] justify-start px-3 md:h-10 md:w-[180px] md:px-4"
          aria-label={`Select reporting year. Currently ${activeYear}`}
        >
          <Calendar className="mr-1.5 h-4 w-4 md:mr-2" />
          <span className="font-semibold">{activeYear}</span>
          {activeYear === currentSystemYear && (
            <span className="ml-auto hidden text-xs text-muted-foreground md:inline">Current</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Select a Year</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {years.map((year) => (
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
