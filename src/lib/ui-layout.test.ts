import { describe, expect, it } from "vitest";

import {
  DEFAULT_LEDGERLY_LAYOUT,
  LEDGERLY_LAYOUTS,
  normalizeLedgerlyLayout,
} from "./ui-layout";

describe("Ledgerly layout preference", () => {
  it.each(LEDGERLY_LAYOUTS)("accepts %s", (layout) => {
    expect(normalizeLedgerlyLayout(layout)).toBe(layout);
  });

  it("defaults missing and unknown stored values to Clarified", () => {
    expect(normalizeLedgerlyLayout(undefined)).toBe(DEFAULT_LEDGERLY_LAYOUT);
    expect(normalizeLedgerlyLayout("prototype-only")).toBe(
      DEFAULT_LEDGERLY_LAYOUT,
    );
  });
});
