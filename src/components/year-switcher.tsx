
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
import { useUserData } from "@/hooks/use-user-data";
import { useMemo } from "react";

export function YearSwitcher() {
  const { activeYear, setActiveYear, firstYear } = useAuth();
  const { setComparisonYear } = useComparison();
  const { allTransactions } = useUserData();

  const transactionYears = useMemo(() => {
    if (!allTransactions.length) return [];
    return Array.from(new Set(allTransactions.map(t => new Date(t.date).getFullYear())));
  }, [allTransactions]);

  const currentSystemYear = new Date().getFullYear();
  
  const years = useMemo(() => {
    const allYears = new Set([currentSystemYear, firstYear, ...transactionYears]);
    return Array.from(allYears).sort((a, b) => b - a);
  }, [currentSystemYear, firstYear, transactionYears]);


  const handleYearChange = (year: number) => {
    setActiveYear(year);
    setComparisonYear(undefined); // Clear comparison when active year changes
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-[180px] justify-start">
          <Calendar className="mr-2 h-4 w-4" />
          <span className="font-semibold">{activeYear}</span>
          {activeYear === currentSystemYear && (
            <span className="ml-auto text-xs text-muted-foreground">Current</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Select a Year</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {years.map((year) => (
          <DropdownMenuItem key={year} onSelect={() => handleYearChange(year)}>
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
