
"use client";

import { useAuth } from "@/hooks/use-auth";
import { useComparison } from "@/hooks/use-comparison";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "./ui/button";
import { GitCompare, Info } from "lucide-react";
import { Badge } from "./ui/badge";

export function ComparisonSwitcher() {
  const { activeYear, firstYear } = useAuth();
  const { comparisonYear, setComparisonYear, isComparing } = useComparison();

  const availableYears = Array.from(
    { length: activeYear - firstYear },
    (_, i) => activeYear - 1 - i
  );

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[180px] justify-start">
            <GitCompare className="mr-2 h-4 w-4" />
            <span className="truncate">
              Compare to: {comparisonYear ?? 'None'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          <DropdownMenuLabel>Select Comparison Year</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setComparisonYear(undefined)}>
            None
          </DropdownMenuItem>
          {availableYears.map((year) => (
            <DropdownMenuItem key={year} onSelect={() => setComparisonYear(year)}>
              {year}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {isComparing && (
        <Badge variant="secondary" className="hidden sm:flex items-center gap-1.5">
           <Info className="h-3 w-3" />
           Read-only
        </Badge>
      )}
    </div>
  );
}
