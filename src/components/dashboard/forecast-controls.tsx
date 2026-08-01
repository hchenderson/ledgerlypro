"use client";

import React from "react";
import { Button } from "@/components/ui/button";

export function Segmented({
  value,
  onChange,
  options,
  ariaLabel = "Chart view",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <div
      className="flex w-full rounded-lg border p-1 sm:w-auto"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <Button
          key={o.value}
          variant={value === o.value ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(o.value)}
          className="h-11 min-w-0 flex-1 rounded-md px-3 sm:h-9 sm:flex-none"
          aria-pressed={value === o.value}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
