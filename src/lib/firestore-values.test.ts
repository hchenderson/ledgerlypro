import { describe, expect, it } from "vitest";

import { withoutUndefined } from "./firestore-values";

describe("withoutUndefined", () => {
  it("removes undefined optional report-view dates before a Firestore write", () => {
    const value = withoutUndefined({
      name: "2026 first half",
      configuration: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z",
        comparisonFrom: undefined,
        comparisonTo: undefined,
      },
    });

    expect(value).toEqual({
      name: "2026 first half",
      configuration: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z",
      },
    });
  });

  it("preserves valid comparison dates and removes undefined array entries", () => {
    const value = withoutUndefined({
      configuration: {
        comparisonFrom: "2025-01-01T00:00:00.000Z",
        comparisonTo: "2025-06-30T23:59:59.999Z",
        accountIds: ["checking", undefined, "savings"],
      },
    });

    expect(value).toEqual({
      configuration: {
        comparisonFrom: "2025-01-01T00:00:00.000Z",
        comparisonTo: "2025-06-30T23:59:59.999Z",
        accountIds: ["checking", "savings"],
      },
    });
  });
});
