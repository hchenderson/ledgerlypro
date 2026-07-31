import { describe, expect, it } from "vitest";

import { planRecurringOccurrences, recurringOccurrenceId } from "./recurring";
import type { RecurringTransaction } from "@/types";

const recurring: RecurringTransaction = {
  id: "rent",
  description: "Rent",
  amount: 1_200,
  type: "expense",
  category: "Housing",
  frequency: "monthly",
  startDate: "2025-01-01T12:00:00.000Z",
  accountId: "checking",
};

describe("planRecurringOccurrences", () => {
  it("creates deterministic occurrence IDs so retries are idempotent", () => {
    const first = planRecurringOccurrences(recurring, new Date("2025-03-15T12:00:00.000Z"));
    const retry = planRecurringOccurrences(recurring, new Date("2025-03-15T12:00:00.000Z"));

    expect(first.occurrences.map(({ id }) => id)).toEqual(
      retry.occurrences.map(({ id }) => id)
    );
    expect(first.occurrences).toHaveLength(3);
    expect(first.occurrences[0].id).toBe(
      recurringOccurrenceId("rent", new Date("2025-01-01T00:00:00.000Z"))
    );
    expect(first.occurrences[0].accountId).toBe("checking");
  });

  it("continues after the last materialized occurrence", () => {
    const result = planRecurringOccurrences(
      { ...recurring, lastAddedDate: "2025-02-01T00:00:00.000Z" },
      new Date("2025-03-15T12:00:00.000Z")
    );

    expect(result.occurrences.map(({ date }) => date.slice(0, 10))).toEqual([
      "2025-03-01",
    ]);
  });

  it("reports when bounded processing has more work", () => {
    const result = planRecurringOccurrences(
      { ...recurring, frequency: "daily" },
      new Date("2025-12-31T12:00:00.000Z"),
      10
    );

    expect(result.occurrences).toHaveLength(10);
    expect(result.hasMore).toBe(true);
  });
});
