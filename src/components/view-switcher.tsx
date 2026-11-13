"use client";

import { LayoutTemplate } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  LEDGERLY_LAYOUT_LABELS,
  LEDGERLY_LAYOUT_SHORT_LABELS,
  LEDGERLY_LAYOUTS,
  type LedgerlyLayout,
} from "@/lib/ui-layout";
import { cn } from "@/lib/utils";

export function ViewSwitcher({ className }: { className?: string }) {
  const { uiLayout, setUiLayout } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const selectLayout = async (layout: LedgerlyLayout) => {
    if (layout === uiLayout) return;
    setIsSaving(true);
    try {
      await setUiLayout(layout);
    } catch {
      toast({
        variant: "destructive",
        title: "View preference was not saved",
        description: "Your previous view has been restored. Try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={cn("shrink-0", className)}
      data-testid="view-switcher"
      data-saving={isSaving ? "true" : "false"}
      aria-busy={isSaving}
      aria-label="Ledgerly view"
    >
      <div className="sm:hidden">
        <Select
          value={uiLayout}
          onValueChange={(value) => void selectLayout(value as LedgerlyLayout)}
        >
          <SelectTrigger className="h-10 min-w-44 bg-card" aria-label="View" disabled={isSaving}>
            <LayoutTemplate className="mr-2 h-4 w-4 text-primary" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEDGERLY_LAYOUTS.map((layout) => (
              <SelectItem key={layout} value={layout}>
                {LEDGERLY_LAYOUT_LABELS[layout]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className="hidden items-center rounded-lg border bg-card p-1 shadow-sm sm:flex"
        role="group"
        aria-label="View"
      >
        {LEDGERLY_LAYOUTS.map((layout) => (
          <Button
            key={layout}
            type="button"
            size="sm"
            variant={layout === uiLayout ? "default" : "ghost"}
            className="h-8 px-3"
            aria-pressed={layout === uiLayout}
            disabled={isSaving}
            onClick={() => void selectLayout(layout)}
          >
            {LEDGERLY_LAYOUT_SHORT_LABELS[layout]}
          </Button>
        ))}
      </div>
    </div>
  );
}
