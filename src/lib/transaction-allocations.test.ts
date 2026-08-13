import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types";
import {
  allocationDifference,
  allocationsAreComplete,
  expandTransactionAllocations,
} from "./transaction-allocations";

const transaction: Transaction = {
  id: "deposit-1",
  date: "2026-08-12T12:00:00.000Z",
  description: "Combined Sunday deposit",
  amount: 2_000,
  type: "income",
  category: "Split transaction",
  accountId: "checking",
  allocations: [
    { id: "general", amount: 1_550, category: "General Giving", categoryId: "general" },
    { id: "mission", amount: 450, category: "Missionary Support", categoryId: "mission" },
  ],
};

describe("transaction allocations", () => {
  it("expands one bank deposit into exact reporting lines", () => {
    const entries = expandTransactionAllocations(transaction);
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.amount)).toEqual([1_550, 450]);
    expect(entries.every((entry) => entry.accountId === "checking")).toBe(true);
    expect(entries.every((entry) => entry.allocationParentId === "deposit-1")).toBe(true);
  });

  it("keeps an incomplete remainder visible and totals unchanged", () => {
    const entries = expandTransactionAllocations({
      ...transaction,
      allocations: transaction.allocations?.slice(1),
    });
    expect(entries.map((entry) => entry.amount)).toEqual([450, 1_550]);
    expect(entries.at(-1)?.category).toBe("Unallocated");
    expect(entries.reduce((sum, entry) => sum + entry.amount, 0)).toBe(2_000);
  });

  it("validates allocations in cents", () => {
    expect(allocationsAreComplete(transaction.amount, transaction.allocations)).toBe(true);
    expect(allocationDifference(2_000, transaction.allocations)).toBe(0);
    expect(allocationDifference(2_000, transaction.allocations?.slice(0, 1))).toBe(450);
  });
});
