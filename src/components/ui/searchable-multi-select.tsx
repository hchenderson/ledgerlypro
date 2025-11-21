
"use client";

import * as React from "react";
import { Check, X, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-auto min-h-10", className)}
        >
          <div className="flex flex-wrap gap-1 items-center flex-1">
            {displayedBadges.length > 0 ? (
              <>
                {displayedBadges.map((option) => (
                  <Badge
                    variant="secondary"
                    key={option.value}
                    className="mr-1 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(selected.filter((v) => v !== option.value));
                    }}
                  >
                    {option.label}
                    <X className="ml-1 h-3 w-3" />
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
        <div className="flex items-center justify-between p-2 border-b bg-muted/50 sticky top-0 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            className="text-xs h-7"
          >
            Select All ({options.length})
          </Button>
          {selected.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-xs h-7"
            >
              Clear All
            </Button>
          )}
        </div>

        {/* Options List */}
        {options.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No options available.
          </div>
        ) : (
          <div className="p-1">
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center px-2 py-2 text-sm cursor-pointer rounded-sm hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent/50"
                  )}
                  onClick={() => handleToggleOption(option.value)}
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-sm border border-primary mr-2",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50"
                    )}
                  >
                    <Check className={cn("h-3 w-3", isSelected ? "opacity-100" : "opacity-0")} />
                  </div>
                  <span className="flex-1">{option.label}</span>
                  {isSelected && (
                    <Badge variant="outline" className="text-xs ml-2">
                      Selected
                    </Badge>
                  )}
                </div>
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
