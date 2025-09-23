
"use client";

import * as React from "react";
import { Check, X, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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

  const displayedBadges = options
    .filter((option) => selected.includes(option.value))
    .slice(0, maxDisplayItems);

  const remainingCount = selected.length - displayedBadges.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild className={className}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-10"
        >
          <div className="flex flex-wrap gap-1 items-center">
            {displayedBadges.length > 0 ? (
              <>
                {displayedBadges.map((option) => (
                  <Badge
                    variant="secondary"
                    key={option.value}
                    className="mr-1"
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
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={handleSelectAll} className="cursor-pointer">
                Select All
              </CommandItem>
              <CommandItem onSelect={handleClearAll} className="cursor-pointer">
                Clear All
              </CommandItem>
            </CommandGroup>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (isSelected) {
                        onChange(selected.filter((v) => v !== option.value));
                      } else {
                        onChange([...selected, option.value]);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { SearchableMultiSelect };
