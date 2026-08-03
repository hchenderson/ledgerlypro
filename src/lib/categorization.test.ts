import { describe, expect, it } from "vitest";

import {
  categorizationRuleMatches,
  categorizeTransaction,
  isTransactionFinalized,
  normalizeRuleText,
} from "@/lib/categorization";
import type { CategorizationRule, Transaction } from "@/types";
import { isFinancialTransaction } from "@/lib/accounts";

const transaction = (values: Partial<Transaction> = {}): Transaction => ({
  id: "transaction-1",
  date: "2026-08-03T12:00:00.000Z",
  description: "KROGER #0417 POS PURCHASE",
  merchantName: "Kroger",
  amount: 86.42,
  type: "expense",
  category: "Uncategorized",
  accountId: "checking",
  postingStatus: "posted",
  ...values,
});

const rule = (
  values: Partial<CategorizationRule> = {},
): CategorizationRule => ({
  id: "rule-1",
  name: "Kroger groceries",
  enabled: true,
  priority: 10,
  conditions: {
    merchantMatch: { operator: "exact", value: "Kroger" },
  },
  actions: {
    categoryId: "groceries",
    categoryName: "Groceries",
    envelopeId: "groceries-envelope",
    markReviewed: true,
  },
  createdAt: "2026-08-03T12:00:00.000Z",
  updatedAt: "2026-08-03T12:00:00.000Z",
  ...values,
});

describe("categorization rules", () => {
  it("normalizes noisy merchant labels", () => {
    expect(normalizeRuleText("Kroger #0417 POS Purchase")).toBe("KROGER");
  });

  it("matches merchant, account, direction, amount, and provider category", () => {
    expect(
      categorizationRuleMatches(
        rule({
          conditions: {
            direction: "expense",
            accountIds: ["checking"],
            merchantMatch: { operator: "contains", value: "kroger" },
            providerCategoryDetailed: "FOOD_AND_DRINK_GROCERIES",
            minimumAmount: 50,
            maximumAmount: 100,
          },
        }),
        transaction({
          providerCategoryDetailed: "FOOD_AND_DRINK_GROCERIES",
        }),
      ),
    ).toBe(true);
  });

  it("uses the highest priority matching rule", () => {
    const result = categorizeTransaction(transaction(), [
      rule({ id: "low", priority: 1 }),
      rule({
        id: "high",
        priority: 20,
        actions: {
          categoryId: "household",
          categoryName: "Household",
          markReviewed: false,
        },
      }),
    ]);
    expect(result).toMatchObject({
      categoryId: "household",
      ruleId: "high",
      status: "needs-review",
    });
  });

  it("sends equal-rank conflicting rules to review", () => {
    const result = categorizeTransaction(transaction(), [
      rule({ id: "groceries" }),
      rule({
        id: "household",
        actions: {
          categoryId: "household",
          categoryName: "Household",
          markReviewed: true,
        },
      }),
    ]);
    expect(result.status).toBe("needs-review");
    expect(result.conflictRuleIds).toEqual(["groceries", "household"]);
  });

  it("never overwrites a locked manual classification", () => {
    const result = categorizeTransaction(
      transaction({
        category: "Medical",
        categoryId: "medical",
        envelopeId: "medical-envelope",
        classificationLocked: true,
      }),
      [rule()],
    );
    expect(result).toMatchObject({
      categoryId: "medical",
      envelopeId: "medical-envelope",
      source: "manual",
    });
  });

  it("keeps pending and removed transactions out of finalized calculations", () => {
    expect(isTransactionFinalized(transaction())).toBe(true);
    expect(
      isTransactionFinalized(transaction({ postingStatus: "pending" })),
    ).toBe(false);
    expect(
      isTransactionFinalized(transaction({ providerRemovedAt: "now" })),
    ).toBe(false);
  });

  it("keeps possible transfers out of reports until a user resolves them", () => {
    expect(isFinancialTransaction(transaction({ possibleTransfer: true }))).toBe(false);
    expect(isFinancialTransaction(transaction({ possibleTransfer: false }))).toBe(true);
  });
});
