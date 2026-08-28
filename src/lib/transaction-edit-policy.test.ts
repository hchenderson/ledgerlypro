import { describe, expect, it } from "vitest";

import {
  canEditTransaction,
  historicalTransactionYear,
} from "@/lib/transaction-edit-policy";

describe("transaction edit policy", () => {
  it("allows historical income and expense corrections", () => {
    expect(canEditTransaction({ type: "income" })).toBe(true);
    expect(canEditTransaction({ type: "expense" })).toBe(true);
  });

  it("keeps linked transfers out of the single-transaction editor", () => {
    expect(canEditTransaction({ type: "transfer" })).toBe(false);
  });

  it("requires confirmation only for dates before the current year", () => {
    expect(historicalTransactionYear({ date: "2025-06-15T12:00:00.000Z" }, 2026)).toBe(2025);
    expect(historicalTransactionYear({ date: "2026-01-01T12:00:00.000Z" }, 2026)).toBeUndefined();
    expect(historicalTransactionYear({ date: "2027-01-01T12:00:00.000Z" }, 2026)).toBeUndefined();
  });
});
