"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, GitCompare, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useComparison } from "@/hooks/use-comparison";

export function ComparisonSwitcher() {
  const pathname = usePathname();
  const { activeYear } = useAuth();
  const { comparisonYear, setComparisonYear, isComparing } = useComparison();
  const isComparisonPage = pathname === "/compare";

  return (
    <div className="flex items-center gap-2">
      <Button
        asChild
        variant={isComparisonPage ? "secondary" : "outline"}
        className="min-w-[150px] justify-between"
      >
        <Link href="/compare">
          <span className="flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            {comparisonYear ? `${activeYear} vs ${comparisonYear}` : "Compare"}
          </span>
          <ArrowRight className="h-4 w-4 opacity-60" />
        </Link>
      </Button>
      {isComparing && !isComparisonPage && (
        <Button
          variant="ghost"
          size="sm"
          className="hidden gap-1.5 px-2 text-muted-foreground xl:flex"
          onClick={() => setComparisonYear(undefined)}
          title="Clear comparison year"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}
