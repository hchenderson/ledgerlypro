import { describe, expect, it } from "vitest";

import { calculateAccountBalance, transactionBalanceDelta } from "./accounts";
import { analyzeData001Dataset, analyzeData001Migration, migrationBatches } from "./data001-migration";
import { dateInTimeZone, toLedgerDate } from "./ledger-date";
import { canonicalMoneyFields, moneyMinor, parseMoneyToMinor } from "./money";
import { buildRefundLink, refundableAmount } from "./refunds";
import { canonicalizeTransactionMoney, expandTransactionAllocations } from "./transaction-allocations";
import { financialReportingTransactions, summarizeTransactions } from "./financial-summary";
import type { Account, Transaction } from "@/types";

const transaction = (values: Partial<Transaction> = {}): Transaction => ({
  id: "transaction",
  date: "2026-01-01",
  description: "Synthetic",
  amount: 10,
  type: "expense",
  category: "Test",
  postingStatus: "posted",
  ...values,
});

describe("DATA-001 money and date conventions", () => {
  it("omits undefined allocations so unsplit records are valid Firestore writes", () => {
    const canonical = canonicalizeTransactionMoney(transaction({
      id: "unsplit",
      amount: 12.34,
      allocations: undefined,
    }));

    expect(canonical).not.toHaveProperty("allocations");
    expect(canonical.amountMinor).toBe(1234);
  });

  it("parses USD exactly once and rejects fractional cents", () => {
    expect(parseMoneyToMinor("12.30")).toBe(1230);
    expect(canonicalMoneyFields("12.30")).toEqual({ amount: 12.3, amountMinor: 1230, currency: "USD" });
    expect(() => parseMoneyToMinor("1.005")).toThrow(/two decimal/);
  });

  it("gives canonical cents precedence over a conflicting legacy field", () => {
    expect(moneyMinor({ amount: 99.99, amountMinor: 1234, currency: "USD" })).toBe(1234);
  });

  it("requires split cents to reconcile and expands each cent once", () => {
    const split = canonicalizeTransactionMoney(transaction({
      amount: 10,
      allocations: [
        { id: "a", amount: 3.33, category: "A", categoryId: "a" },
        { id: "b", amount: 6.67, category: "B", categoryId: "b" },
      ],
    }));
    expect(expandTransactionAllocations(split).map((line) => line.amountMinor)).toEqual([333, 667]);
    expect(() => canonicalizeTransactionMoney(transaction({
      allocations: [
        { id: "a", amount: 3.33, category: "A", categoryId: "a" },
        { id: "b", amount: 6.66, category: "B", categoryId: "b" },
      ],
    }))).toThrow(/equal/);
  });

  it("keeps a date-only ledger day stable and maps source instants in the owner zone", () => {
    expect(toLedgerDate("2025-12-31", "Pacific/Honolulu")).toBe("2025-12-31");
    expect(dateInTimeZone(new Date("2026-01-01T02:00:00.000Z"), "America/New_York")).toBe("2025-12-31");
    expect(dateInTimeZone(new Date("2026-01-01T02:00:00.000Z"), "Asia/Tokyo")).toBe("2026-01-01");
  });

  it("reconciles transfer cents without affecting financial income or expense", () => {
    const outgoing = transaction({ id: "out", amount: 12.34, amountMinor: 1234, type: "transfer", transferDirection: "out" });
    const incoming = transaction({ id: "in", amount: 12.34, amountMinor: 1234, type: "transfer", transferDirection: "in" });
    expect(transactionBalanceDelta(outgoing)).toBe(-12.34);
    expect(transactionBalanceDelta(incoming)).toBe(12.34);
  });
});

describe("DATA-001 refund contract", () => {
  const original = transaction({ id: "purchase", amount: 100, amountMinor: 10_000, categoryId: "supplies" });
  const credit = transaction({ id: "credit", amount: 40, amountMinor: 4_000, type: "income", category: "Uncategorized" });

  it("supports partial and multiple refunds without exceeding the original", () => {
    const first = buildRefundLink({ refund: credit, original, existingRefunds: [] });
    expect(refundableAmount(original, [first])).toBe(60);
    const second = buildRefundLink({ refund: transaction({ id: "credit-2", amount: 60, amountMinor: 6000, type: "income" }), original, existingRefunds: [first] });
    expect(refundableAmount(original, [first, second])).toBe(0);
    expect(() => buildRefundLink({ refund: transaction({ id: "credit-3", amount: 1, amountMinor: 100, type: "income" }), original, existingRefunds: [first, second] })).toThrow(/exceeds/);
  });

  it("requires explicit allocation for a refund against a split purchase", () => {
    const splitOriginal = canonicalizeTransactionMoney(transaction({
      id: "split-purchase",
      amount: 100,
      allocations: [
        { id: "food", amount: 70, category: "Food", categoryId: "food" },
        { id: "goods", amount: 30, category: "Goods", categoryId: "goods" },
      ],
    }));
    expect(() => buildRefundLink({ refund: credit, original: splitOriginal, existingRefunds: [] })).toThrow(/split categories/);
  });

  it("returns a changed-provider refund to income review instead of silently preserving the link effect", () => {
    const linked = buildRefundLink({ refund: credit, original, existingRefunds: [] });
    const exception = { ...linked, refundStatus: "exception" as const };
    expect(financialReportingTransactions([exception])[0].type).toBe("income");
    expect(summarizeTransactions([exception])).toMatchObject({ income: 40, expenses: 0, net: 40 });
  });
});

describe("DATA-001 migration dry run", () => {
  it("separates clean conversions from review records and is idempotent", () => {
    const legacy = transaction({ id: "legacy", date: "2026-01-01T12:00:00.000Z", amount: 10.25 });
    const ambiguous = transaction({ id: "ambiguous", date: "2026-01-01T09:00:00", amount: 1.005 });
    const first = analyzeData001Migration([legacy, ambiguous], "America/New_York");
    expect(first).toMatchObject({ total: 2, clean: 1, needsReview: 1, amountConversions: 2, ledgerDateConversions: 2 });
    expect(first.records.find((record) => record.id === "ambiguous")?.reasons).toEqual(expect.arrayContaining(["ambiguous-date", "fractional-cent-rounded"]));
    const migrated = first.records.filter((record) => record.status === "clean").map((record) => record.proposed!);
    const second = analyzeData001Migration(migrated, "America/New_York");
    expect(second).toMatchObject({ alreadyCanonical: 1, needsReview: 0, amountConversions: 0, ledgerDateConversions: 0 });
  });

  it("flags locale-dependent legacy dates for review", () => {
    const report = analyzeData001Migration([
      transaction({ id: "locale-date", date: "01/19/2026" }),
    ], "America/New_York");
    expect(report.records[0].reasons).toContain("ambiguous-date");
  });

  it("resumes deterministic batches after an interrupted run", () => {
    const report = analyzeData001Migration([
      transaction({ id: "a" }), transaction({ id: "b" }), transaction({ id: "c" }),
    ], "America/New_York");
    expect(migrationBatches(report, new Set(["a"]), 1).map((batch) => batch[0].id)).toEqual(["b", "c"]);
  });

  it("reads mixed legacy and canonical account activity in cents", () => {
    const account: Account = { id: "account", name: "Checking", type: "checking", classification: "asset", openingBalance: 10, openingBalanceMinor: 1000, currency: "USD", createdAt: "2026-01-01", isDefault: true };
    expect(calculateAccountBalance(account, [
      transaction({ id: "legacy", accountId: "account", type: "income", amount: 1.25 }),
      transaction({ id: "canonical", accountId: "account", type: "expense", amount: 99, amountMinor: 50, currency: "USD" }),
    ])).toBe(10.75);
  });

  it("reports non-transaction money collections without writing them", () => {
    const result = analyzeData001Dataset({
      transactions: [],
      accounts: [{ id: "a", name: "Checking", type: "checking", classification: "asset", openingBalance: 10, currency: "USD", createdAt: "2026-01-01" }],
      budgets: [{ id: "b", categoryId: "c", amount: 12, amountMinor: 999, currency: "USD", period: "monthly", year: 2026 }],
      recurringTransactions: [{ id: "r", description: "Bill", amount: 5, amountMinor: 500, currency: "USD", type: "expense", category: "Bills", frequency: "monthly", startDate: "2026-01-01" }],
    }, "America/New_York");
    expect(result.collections).toEqual({
      accounts: { total: 1, clean: 1, alreadyCanonical: 0, needsReview: 0 },
      budgets: { total: 1, clean: 0, alreadyCanonical: 0, needsReview: 1 },
      recurringTransactions: { total: 1, clean: 0, alreadyCanonical: 1, needsReview: 0 },
    });
  });
});
