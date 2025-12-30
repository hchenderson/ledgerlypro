
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

export function YearSwitcher() {
  const { activeYear, setActiveYear, firstYear } = useAuth();

  const currentSystemYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentSystemYear - firstYear + 1 },
    (_, i) => currentSystemYear - i
  );

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
          <DropdownMenuItem key={year} onSelect={() => setActiveYear(year)}>
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
