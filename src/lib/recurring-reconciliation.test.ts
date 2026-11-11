import { describe, expect, it } from "vitest";

import {
  buildRecurringMatchCandidates,
  confirmRecurringMatch,
  dismissRecurringCandidate,
  invalidateRecurringMatch,
  refreshRecurringMatch,
  skipRecurringOccurrence,
  undoDismissRecurringCandidate,
  unlinkRecurringMatch,
} from "./recurring-reconciliation";
import {
  recurringOccurrenceFromLegacyTransaction,
  recurringOccurrenceFromSchedule,
} from "./recurring";
import type { RecurringOccurrence, RecurringTransaction, Transaction } from "@/types";

const NOW = "2026-04-01T12:00:00.000Z";

const schedule: RecurringTransaction = {
  id: "electricity",
  description: "Acme Electric",
  amount: 100,
  type: "expense",
  category: "Utilities",
  categoryId: "utilities",
  accountId: "checking",
  frequency: "monthly",
  startDate: "2026-04-10T00:00:00.000Z",
};

function occurrence(
  extras: Partial<RecurringOccurrence> = {},
): RecurringOccurrence {
  return {
    ...recurringOccurrenceFromSchedule(
      schedule,
      new Date("2026-04-10T00:00:00.000Z"),
      NOW,
    ),
    ...extras,
  };
}

function actual(
  id: string,
  date = "2026-04-10T12:00:00.000Z",
  amount = 103,
  extras: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    date,
    amount,
    type: "expense",
    description: "ACME ELECTRIC PAYMENT",
    merchantName: "Acme Electric",
    category: "Utilities",
    categoryId: "utilities",
    accountId: "checking",
    provider: "plaid",
    postingStatus: "posted",
    ...extras,
  };
}

describe("recurring reconciliation candidate rules", () => {
  it("suggests early and late finalized postings within the documented window", () => {
    const candidates = buildRecurringMatchCandidates(
      [occurrence()],
      [
        actual("early", "2026-04-05T12:00:00.000Z"),
        actual("late", "2026-04-17T12:00:00.000Z"),
        actual("too-early", "2026-04-04T12:00:00.000Z"),
        actual("too-late", "2026-04-18T12:00:00.000Z"),
      ],
    );

    expect(candidates.map((candidate) => candidate.transactionId).sort()).toEqual([
      "early",
      "late",
    ]);
    expect(candidates.every((candidate) => candidate.ambiguous)).toBe(true);
  });

  it("supports changed and partial amounts only with matching merchant provenance", () => {
    const candidates = buildRecurringMatchCandidates(
      [occurrence()],
      [
        actual("changed", undefined, 145),
        actual("partial", undefined, 40),
        actual("unrelated", undefined, 40, {
          merchantName: "Other Vendor",
          description: "Other Vendor",
        }),
      ],
    );

    expect(candidates.map((candidate) => candidate.transactionId).sort()).toEqual([
      "changed",
      "partial",
    ]);
    expect(
      candidates.find((candidate) => candidate.transactionId === "partial")?.reasons,
    ).toContain("possible partial payment");
  });

  it("deduplicates duplicate imports and rejects ineligible/provider-transition records", () => {
    const posted = actual("same-id");
    const candidates = buildRecurringMatchCandidates(
      [occurrence()],
      [
        posted,
        { ...posted },
        actual("pending", undefined, 100, { postingStatus: "pending" }),
        actual("removed", undefined, 100, {
          postingStatus: "removed",
          providerRemovedAt: NOW,
        }),
        actual("possible-transfer", undefined, 100, { possibleTransfer: true }),
        actual("transfer", undefined, 100, { type: "transfer" }),
      ],
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].transactionId).toBe("same-id");
  });

  it("offers a provider transaction only after its pending-to-posted transition", () => {
    const pending = actual("provider-id", undefined, 100, {
      postingStatus: "pending",
    });
    expect(buildRecurringMatchCandidates([occurrence()], [pending])).toEqual([]);

    const posted = { ...pending, postingStatus: "posted" as const };
    const candidates = buildRecurringMatchCandidates([occurrence()], [posted]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].transactionId).toBe("provider-id");
  });

  it("respects account and direction and never offers an actual already linked elsewhere", () => {
    const candidates = buildRecurringMatchCandidates(
      [occurrence()],
      [
        actual("wrong-account", undefined, 100, { accountId: "savings" }),
        actual("wrong-direction", undefined, 100, { type: "income" }),
        actual("already-linked", undefined, 100, {
          recurringOccurrenceId: "another_2026-04-10",
        }),
      ],
    );

    expect(candidates).toEqual([]);
  });

  it("keeps dismissals reversible without making a match automatically", () => {
    const dismissed = dismissRecurringCandidate(occurrence(), "bank", NOW);
    expect(buildRecurringMatchCandidates([dismissed], [actual("bank")])).toEqual([]);

    const restored = undoDismissRecurringCandidate(
      dismissed,
      "bank",
      "2026-04-02T12:00:00.000Z",
    );
    expect(buildRecurringMatchCandidates([restored], [actual("bank")])).toHaveLength(1);
  });
});

describe("recurring reconciliation state transitions", () => {
  it("fulfills a $100 expectation with one confirmed $103 actual and is retry-safe", () => {
    const transaction = actual("posted-103");
    const confirmed = confirmRecurringMatch(occurrence(), transaction, NOW);
    const retried = confirmRecurringMatch(confirmed, transaction, NOW);

    expect(confirmed).toMatchObject({
      status: "fulfilled",
      matchedAmount: 103,
      remainingAmount: 0,
      varianceAmount: 3,
    });
    expect(confirmed.matches).toHaveLength(1);
    expect(retried).toBe(confirmed);
  });

  it("supports partial payments and only forecasts the remainder", () => {
    const first = actual("partial-1", undefined, 40);
    const second = actual("partial-2", "2026-04-12T12:00:00.000Z", 60);
    const partial = confirmRecurringMatch(occurrence(), first, NOW);
    const complete = confirmRecurringMatch(partial, second, "2026-04-12T13:00:00.000Z");

    expect(partial).toMatchObject({
      status: "partially-fulfilled",
      matchedAmount: 40,
      remainingAmount: 60,
    });
    expect(complete).toMatchObject({
      status: "fulfilled",
      matchedAmount: 100,
      remainingAmount: 0,
    });
  });

  it("returns an invalidated or removed actual to the forecast without relinking", () => {
    const transaction = actual("posted-103");
    const confirmed = confirmRecurringMatch(occurrence(), transaction, NOW);
    const removed = invalidateRecurringMatch(
      confirmed,
      transaction.id,
      "linked-provider-transaction-removed",
      "2026-04-15T12:00:00.000Z",
    );

    expect(removed).toMatchObject({
      status: "exception",
      matchedAmount: 0,
      remainingAmount: 100,
      exceptionReason: "linked-provider-transaction-removed",
    });
    expect(removed.matches[0]).toMatchObject({ status: "invalidated" });
  });

  it("refreshes a posted provider modification and unlinking restores the expectation", () => {
    const linked = confirmRecurringMatch(occurrence(), actual("bank", undefined, 103), NOW);
    const modified = refreshRecurringMatch(
      linked,
      actual("bank", "2026-04-11T12:00:00.000Z", 107),
      "2026-04-11T13:00:00.000Z",
    );
    const unlinked = unlinkRecurringMatch(
      modified,
      "bank",
      "2026-04-12T12:00:00.000Z",
    );

    expect(modified).toMatchObject({ matchedAmount: 107, varianceAmount: 7 });
    expect(modified.matches[0].postingDate).toBe("2026-04-11T12:00:00.000Z");
    expect(unlinked).toMatchObject({
      status: "expected",
      matchedAmount: 0,
      remainingAmount: 100,
    });
  });

  it("excludes skipped occurrences and requires linked payments to be unlinked first", () => {
    const skipped = skipRecurringOccurrence(occurrence(), NOW);
    expect(skipped.status).toBe("skipped");
    expect(() =>
      skipRecurringOccurrence(
        confirmRecurringMatch(occurrence(), actual("bank"), NOW),
        NOW,
      ),
    ).toThrow(/unlink/i);
  });

  it("prevents a single actual from fulfilling competing occurrences", () => {
    const bank = actual("bank");
    const first = confirmRecurringMatch(occurrence(), bank, NOW);
    expect(first.status).toBe("fulfilled");

    expect(() =>
      confirmRecurringMatch(
        occurrence({ id: "other_2026-04-10" }),
        { ...bank, recurringOccurrenceId: first.id },
        NOW,
      ),
    ).toThrow(/another occurrence/i);
  });

  it("only converts legacy records with explicit recurring provenance", () => {
    const explicit = recurringOccurrenceFromLegacyTransaction({
      ...actual("legacy", undefined, 100),
      source: "recurring",
      recurringTransactionId: schedule.id,
      description: "(Recurring) Acme Electric",
    });
    const prefixOnly = recurringOccurrenceFromLegacyTransaction({
      ...actual("prefix", undefined, 100),
      description: "(Recurring) Acme Electric",
    });

    expect(explicit).toMatchObject({
      legacyTransactionId: "legacy",
      recurringTransactionId: schedule.id,
      expectedAmount: 100,
    });
    expect(prefixOnly).toBeNull();
  });
});
