
"use client";

import * as React from "react";
import { Check, X, ChevronsUpDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export type OptionType = {
  label: string;
  value: string;
};

interface SearchableMultiSelectProps {
  options: OptionType[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  maxDisplayItems?: number;
  className?: string;
}

function SearchableMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  maxDisplayItems = 3,
  className,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const searchId = React.useId();

  const handleSelectAll = () => {
    onChange(options.map((option) => option.value));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleToggleOption = (optionValue: string) => {
    const isSelected = selected.includes(optionValue);
    if (isSelected) {
      onChange(selected.filter((v) => v !== optionValue));
    } else {
      onChange([...selected, optionValue]);
    }
  };

  const displayedBadges = options
    .filter((option) => selected.includes(option.value))
    .slice(0, maxDisplayItems);

  const remainingCount = selected.length - displayedBadges.length;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) =>
        option.label.toLocaleLowerCase().includes(normalizedQuery),
      )
    : options;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-auto min-h-11 w-full justify-between", className)}
        >
          <div className="flex flex-wrap gap-1 items-center flex-1">
            {displayedBadges.length > 0 ? (
              <>
                {displayedBadges.map((option) => (
                  <Badge
                    variant="secondary"
                    key={option.value}
                    className="mr-1"
                  >
                    {option.label}
                    <X className="ml-1 h-3 w-3" aria-hidden="true" />
                  </Badge>
                ))}
                {remainingCount > 0 && (
                  <Badge variant="secondary" className="mr-1">
                    +{remainingCount} more
                  </Badge>
                )}
              </>
            ) : (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 max-h-[min(var(--radix-popover-content-available-height),32rem)] overflow-y-auto"
        align="start"
      >
        {/* Action Buttons */}
        <div className="sticky top-0 z-10 space-y-2 border-b bg-popover p-2">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-11 text-xs md:h-7"
            >
              Select All ({options.length})
            </Button>
            {selected.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-11 text-xs md:h-7"
              >
                Clear All
              </Button>
            )}
          </div>
          <div className="relative">
            <label htmlFor={searchId} className="sr-only">
              {searchPlaceholder}
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
        </div>

        {/* Options List */}
        {filteredOptions.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {options.length === 0
              ? "No options available."
              : `No options match “${query.trim()}”.`}
          </div>
        ) : (
          <div className="p-1">
            {filteredOptions.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  type="button"
                  key={option.value}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex min-h-11 w-full cursor-pointer items-center rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    isSelected && "bg-accent/50"
                  )}
                  onClick={() => handleToggleOption(option.value)}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-sm border border-primary mr-2",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50"
                    )}
                  >
                    <Check className={cn("h-3 w-3", isSelected ? "opacity-100" : "opacity-0")} />
                  </span>
                  <span className="flex-1">{option.label}</span>
                  {isSelected && (
                    <Badge variant="outline" className="text-xs ml-2">
                      Selected
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {selected.length > 0 && (
          <div className="border-t p-2 bg-muted/30 sticky bottom-0 z-10">
            <div className="text-xs text-muted-foreground text-center">
              {selected.length} of {options.length} selected
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export { SearchableMultiSelect };
