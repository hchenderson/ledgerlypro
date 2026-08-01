import { describe, expect, it } from "vitest";

import { domainSubscriptionsForPath } from "./data-subscriptions";

describe("domain subscription routing", () => {
  it("loads every dashboard domain", () => {
    expect(domainSubscriptionsForPath("/dashboard")).toEqual({
      budgets: true,
      goals: true,
      recurringTransactions: true,
      settings: false,
    });
  });

  it("keeps comparison pages limited to shared category data", () => {
    expect(domainSubscriptionsForPath("/compare")).toEqual({
      budgets: false,
      goals: false,
      recurringTransactions: false,
      settings: false,
    });
  });

  it("loads only end-of-year report dependencies", () => {
    expect(domainSubscriptionsForPath("/reports/eoy")).toEqual({
      budgets: false,
      goals: true,
      recurringTransactions: false,
      settings: false,
    });
  });

  it("loads recurring schedules for projections", () => {
    expect(
      domainSubscriptionsForPath("/projections")
        .recurringTransactions,
    ).toBe(true);
  });
});
