
"use client";

import * as React from "react";
import { X, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandInput
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type Option = Record<"value" | "label", string>;

interface MultiSelectProps {
    options: Option[];
    selected: string[];
    onChange: (value: string[]) => void;
    className?: string;
    placeholder?: string;
}

export function MultiSelect({ options, selected, onChange, className, placeholder = 'Select options...' }: MultiSelectProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const handleUnselect = React.useCallback((optionValue: string) => {
    onChange(selected.filter((s) => s !== optionValue));
  }, [onChange, selected]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const input = inputRef.current;
    if (input) {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (input.value === "") {
          const newSelected = [...selected];
          newSelected.pop();
          onChange(newSelected);
        }
      }
      if (e.key === "Escape") {
        input.blur();
      }
    }
  }, [onChange, selected]);
  
  const handleSelect = React.useCallback((optionValue: string) => {
    setInputValue("");
    if (selected.includes(optionValue)) {
      handleUnselect(optionValue);
    } else {
      onChange([...selected, optionValue]);
    }
  }, [onChange, selected, handleUnselect]);
  
  const handleBlur = React.useCallback(() => {
    // Delay blur handling to allow onSelect to fire
    setTimeout(() => {
        setOpen(false);
    }, 100);
  }, []);

  const selectables = options.filter(option => !selected.includes(option.value));
  const selectedOptions = options.filter(option => selected.includes(option.value));
  
  const effectivePlaceholder = selected.length > 0 ? '' : placeholder;

  return (
    <Command onKeyDown={handleKeyDown} className={cn("overflow-visible bg-transparent", className)}>
      <Button
        type="button"
        variant="outline"
        className="group w-full h-auto min-h-10 px-3 py-2 text-sm ring-offset-background rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
         onClick={() => {
            setOpen(true);
            inputRef.current?.focus();
        }}
      >
        <div className="flex gap-1 flex-wrap w-full justify-start">
          {selected.map((optionValue) => {
            const option = options.find(o => o.value === optionValue);
            return (
              <Badge key={optionValue} variant="secondary">
                {option?.label}
                <button
                  className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleUnselect(optionValue);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnselect(optionValue)
                  }}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            );
          })}
          <CommandInput
            ref={inputRef}
            value={inputValue}
            onValueChange={setInputValue}
            onBlur={handleBlur}
            onFocus={() => setOpen(true)}
            placeholder={effectivePlaceholder}
            className="ml-2 bg-transparent outline-none placeholder:text-muted-foreground flex-1 h-full p-0"
          />
        </div>
      </Button>
      <div className="relative mt-2">
        {open && (options.length > 0) ? (
          <div className="absolute w-full z-10 top-0 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in max-h-64 overflow-y-auto">
            <CommandGroup>
              {[...selectedOptions, ...selectables].map((option) => {
                 const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onSelect={(_value) => {
                      handleSelect(option.value);
                      inputRef.current?.focus();
                    }}
                    className={"cursor-pointer flex items-center justify-between"}
                  >
                    {option.label}
                    {isSelected && <Check className="h-4 w-4" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ) : null}
      </div>
    </Command>
  );
}
