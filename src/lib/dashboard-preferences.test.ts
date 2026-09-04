import { describe, expect, it } from "vitest";

import {
  DEFAULT_DASHBOARD_PREFERENCES,
  normalizeDashboardPreferences,
} from "./dashboard-preferences";

describe("normalizeDashboardPreferences", () => {
  it("uses all cards and no category filters for existing users", () => {
    expect(normalizeDashboardPreferences(undefined)).toEqual(
      DEFAULT_DASHBOARD_PREFERENCES,
    );
  });

  it("preserves an intentionally empty card list and removes invalid values", () => {
    expect(
      normalizeDashboardPreferences({
        visibleCards: [],
        includedCategoryKeys: ["income:gifts", "income:gifts"],
        excludedCategoryKeys: ["income:gifts", "expense:projects"],
      }),
    ).toEqual({
      visibleCards: [],
      includedCategoryKeys: ["income:gifts"],
      excludedCategoryKeys: ["expense:projects"],
    });
  });

  it("drops unknown card identifiers", () => {
    expect(
      normalizeDashboardPreferences({
        visibleCards: ["balance", "not-a-real-card"],
      }).visibleCards,
    ).toEqual(["balance"]);
  });
});
