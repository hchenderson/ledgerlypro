import { describe, expect, it } from "vitest";

import { findTransferCandidates } from "./transfer-matching";
import type { Transaction } from "@/types";

function transaction(
  values: Partial<Transaction> & Pick<Transaction, "id" | "type">,
): Transaction {
  return {
    date: "2026-07-10T12:00:00.000Z",
    description: "Online transfer",
    amount: 250,
    category: values.type === "income" ? "Other Income" : "Other",
    accountId: values.type === "income" ? "savings" : "checking",
    ...values,
  };
}

describe("findTransferCandidates", () => {
  it("matches equal opposite entries across accounts within three days", () => {
    const candidates = findTransferCandidates([
      transaction({ id: "out", type: "expense" }),
      transaction({
        id: "in",
        type: "income",
        date: "2026-07-11T12:00:00.000Z",
      }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      id: "out:in",
      amount: 250,
      dateDifferenceDays: 1,
    });
  });

  it("does not match entries in one account or different amounts", () => {
    expect(
      findTransferCandidates([
        transaction({ id: "out", type: "expense" }),
        transaction({
          id: "same-account",
          type: "income",
          accountId: "checking",
        }),
        transaction({
          id: "wrong-amount",
          type: "income",
          amount: 251,
        }),
      ]),
    ).toEqual([]);
  });

  it("does not suggest existing transfers and uses each entry once", () => {
    const candidates = findTransferCandidates([
      transaction({ id: "out", type: "expense" }),
      transaction({ id: "in-1", type: "income" }),
      transaction({
        id: "in-2",
        type: "income",
        date: "2026-07-12T12:00:00.000Z",
      }),
      transaction({
        id: "linked",
        type: "expense",
        transferId: "transfer-1",
      }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].incoming.id).toBe("in-1");
  });
});
