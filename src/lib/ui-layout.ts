export const LEDGERLY_LAYOUTS = [
  "clarified",
  "bookkeepers-desk",
  "financial-brief",
] as const;

export type LedgerlyLayout = (typeof LEDGERLY_LAYOUTS)[number];

export const DEFAULT_LEDGERLY_LAYOUT: LedgerlyLayout = "clarified";

export const LEDGERLY_LAYOUT_LABELS: Record<LedgerlyLayout, string> = {
  clarified: "Ledgerly Clarified",
  "bookkeepers-desk": "Bookkeeper’s Desk",
  "financial-brief": "Financial Brief",
};

export const LEDGERLY_LAYOUT_SHORT_LABELS: Record<LedgerlyLayout, string> = {
  clarified: "Clarified",
  "bookkeepers-desk": "Desk",
  "financial-brief": "Brief",
};

export function normalizeLedgerlyLayout(value: unknown): LedgerlyLayout {
  return LEDGERLY_LAYOUTS.includes(value as LedgerlyLayout)
    ? (value as LedgerlyLayout)
    : DEFAULT_LEDGERLY_LAYOUT;
}
