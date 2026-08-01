
"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageNeighbours?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageNeighbours = 1,
}: PaginationProps) {
  if (pageNeighbours === 0) {
    return (
      <nav
        className="flex w-full items-center justify-between gap-3 py-4"
        aria-label="Pagination"
      >
        <Button
          variant="outline"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Go to previous page"
          className="min-w-11"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden min-[360px]:inline">Previous</span>
        </Button>
        <span className="shrink-0 text-sm font-medium tabular-nums">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Go to next page"
          className="min-w-11"
        >
          <span className="hidden min-[360px]:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    );
  }

  const pageNumbers = [];
  const startPage = Math.max(1, currentPage - pageNeighbours);
  const endPage = Math.min(totalPages, currentPage + pageNeighbours);

  if (startPage > 1) {
    pageNumbers.push(1);
    if (startPage > 2) {
      pageNumbers.push(-1); // Ellipsis
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pageNumbers.push(-1); // Ellipsis
    }
    pageNumbers.push(totalPages);
  }

  return (
    <nav
      className="flex items-center justify-center space-x-2 py-4"
      aria-label="Pagination"
    >
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        aria-label="Go to first page"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Go to previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center space-x-1">
        {pageNumbers.map((page, index) =>
          page === -1 ? (
            <span key={index} className="px-2 py-1">...</span>
          ) : (
            <Button
              key={index}
              variant={currentPage === page ? "default" : "outline"}
              size="icon"
              onClick={() => onPageChange(page)}
              aria-label={`Go to page ${page}`}
              aria-current={currentPage === page ? "page" : undefined}
            >
              {page}
            </Button>
          )
        )}
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Go to next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        aria-label="Go to last page"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
