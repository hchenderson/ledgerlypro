"use client";

import React from "react";
import { Button } from "@/components/ui/button";

export function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border p-1">
      {options.map((o) => (
        <Button
          key={o.value}
          variant={value === o.value ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(o.value)}
          className="rounded-md"
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
