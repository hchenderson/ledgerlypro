import { describe, expect, it } from "vitest";

import {
  calculatePendingEnvelopeCommitments,
  calculateEnvelopeSummary,
  calculateUnassignedCash,
  envelopeEventsForTransfer,
  suggestEnvelopeForTransaction,
} from "@/lib/envelopes";
import type { Account, Envelope, EnvelopeEvent, Transaction } from "@/types";

const travel: Envelope = {
  id: "travel",
  name: "Travel",
  type: "sinking-fund",
  backingAccountId: "travel-account",
  categoryIds: ["travel-category"],
  targetAmount: 2_000,
  fundingFrequency: "monthly",
  fundingAmount: 250,
  priority: 1,
  rollover: "rollover",
  color: "#285943",
  icon: "Plane",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function event(
  id: string,
  type: EnvelopeEvent["type"],
  amount: number,
  extra: Partial<EnvelopeEvent> = {},
): EnvelopeEvent {
  return {
    id,
    envelopeId: travel.id,
    type,
    amount,
    date: "2026-08-01T12:00:00.000Z",
    createdAt: "2026-08-01T12:00:00.000Z",
    ...extra,
  };
}

describe("envelope accounting", () => {
  it("keeps released money available until it is spent", () => {
    const summary = calculateEnvelopeSummary(travel, [
      event("start", "starting-allocation", 1_000),
      event("release", "release", 200),
      event("spend", "expense", 150, { usesReleasedFunds: true }),
    ]);

    expect(summary.available).toBe(850);
    expect(summary.reservedInOperating).toBe(50);
    expect(summary.spent).toBe(150);
  });

  it("returns unused money without changing availability", () => {
    const summary = calculateEnvelopeSummary(travel, [
      event("start", "starting-allocation", 1_000),
      event("release", "release", 200),
      event("return", "return", 50),
    ]);

    expect(summary.available).toBe(1_000);
    expect(summary.reservedInOperating).toBe(150);
  });

  it("never counts funding and reallocation as spending", () => {
    const summary = calculateEnvelopeSummary(travel, [
      event("fund", "fund", 300),
      event("in", "reassign-in", 100),
      event("out", "reassign-out", 25),
    ]);

    expect(summary.available).toBe(375);
    expect(summary.funded).toBe(300);
    expect(summary.spent).toBe(0);
  });

  it("restores availability when a refund is assigned", () => {
    const summary = calculateEnvelopeSummary(travel, [
      event("start", "starting-allocation", 500),
      event("spend", "expense", 100),
      event("refund", "refund", 35),
    ]);

    expect(summary.available).toBe(435);
    expect(summary.spent).toBe(100);
  });

  it("creates a balanced pair of envelope reallocation events", () => {
    const events = envelopeEventsForTransfer({
      transferId: "transfer-1",
      envelopeId: "travel",
      relatedEnvelopeId: "bills",
      purpose: "reallocate",
      amount: 125,
      date: "2026-08-01T12:00:00.000Z",
    });

    expect(events).toHaveLength(2);
    expect(events.map((item) => item.type)).toEqual([
      "reassign-out",
      "reassign-in",
    ]);
    expect(
      events.reduce(
        (total, item) =>
          total + (item.type === "reassign-in" ? item.amount : -item.amount),
        0,
      ),
    ).toBe(0);
  });

  it("calculates historical availability as of the report end date", () => {
    const summary = calculateEnvelopeSummary(
      travel,
      [
        event("start", "starting-allocation", 500, {
          date: "2026-01-01T12:00:00.000Z",
        }),
        event("later", "expense", 100, {
          date: "2026-09-01T12:00:00.000Z",
        }),
      ],
      { to: new Date("2026-06-30T12:00:00.000Z") },
    );

    expect(summary.available).toBe(500);
    expect(summary.spent).toBe(0);
  });

  it("keeps internal transfers neutral when calculating unassigned cash", () => {
    const checking: Account = {
      id: "main",
      name: "Main",
      type: "checking",
      classification: "asset",
      openingBalance: 1_000,
      currency: "USD",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const savings: Account = {
      ...checking,
      id: "travel-account",
      name: "Travel",
      openingBalance: 0,
    };
    const transfer: Transaction[] = [
      {
        id: "out",
        date: "2026-08-01T12:00:00.000Z",
        description: "Fund Travel",
        amount: 300,
        type: "transfer",
        category: "Transfer",
        accountId: checking.id,
        transferDirection: "out",
      },
      {
        id: "in",
        date: "2026-08-01T12:00:00.000Z",
        description: "Fund Travel",
        amount: 300,
        type: "transfer",
        category: "Transfer",
        accountId: savings.id,
        transferDirection: "in",
      },
    ];
    const summary = calculateEnvelopeSummary(travel, [
      event("fund", "fund", 300),
    ]);

    expect(
      calculateUnassignedCash({
        accounts: [checking, savings],
        transactions: transfer,
        summaries: [summary],
      }),
    ).toBe(700);
  });

  it("suggests an account-backed envelope before a category match", () => {
    const categoryEnvelope = {
      ...travel,
      id: "category-envelope",
      backingAccountId: "other-account",
      categoryIds: ["travel-category"],
    };
    expect(
      suggestEnvelopeForTransaction(
        {
          type: "expense",
          accountId: travel.backingAccountId,
          categoryId: "travel-category",
        },
        [categoryEnvelope, travel],
      )?.id,
    ).toBe(travel.id);
  });

  it("reserves pending envelope expenses without posting them", () => {
    const pending: Transaction[] = [
      {
        id: "pending",
        date: "2026-08-03T12:00:00.000Z",
        description: "Pending hotel",
        amount: 125,
        type: "expense",
        category: "Travel",
        envelopeId: travel.id,
        postingStatus: "pending",
      },
      {
        id: "outside-period",
        date: "2026-09-03T12:00:00.000Z",
        description: "Later hotel",
        amount: 75,
        type: "expense",
        category: "Travel",
        envelopeId: travel.id,
        postingStatus: "pending",
      },
    ];

    expect(
      calculatePendingEnvelopeCommitments(pending, travel.id, {
        from: new Date("2026-08-01T00:00:00.000Z"),
        to: new Date("2026-08-31T23:59:59.999Z"),
      }),
    ).toBe(125);
  });
});
