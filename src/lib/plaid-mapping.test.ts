import { describe, expect, it } from "vitest";

import {
  normalizePlaidTransaction,
  plaidAccountType,
  stablePlaidTransactionDocumentId,
} from "@/lib/plaid-mapping";
import type { CategorizationRule } from "@/types";

const groceryRule: CategorizationRule = {
  id: "grocery-rule",
  name: "Grocery stores",
  enabled: true,
  priority: 10,
  conditions: {
    providerCategoryDetailed: "FOOD_AND_DRINK_GROCERIES",
  },
  actions: {
    categoryId: "groceries",
    categoryName: "Groceries",
    envelopeId: "grocery-envelope",
    markReviewed: true,
  },
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("Plaid mapping", () => {
  it("creates stable provider document ids", () => {
    expect(stablePlaidTransactionDocumentId("item", "transaction")).toBe(
      stablePlaidTransactionDocumentId("item", "transaction"),
    );
    expect(stablePlaidTransactionDocumentId("item", "other")).not.toBe(
      stablePlaidTransactionDocumentId("item", "transaction"),
    );
  });

  it("normalizes Plaid signs and applies a user rule", () => {
    const result = normalizePlaidTransaction({
      plaidItemId: "item",
      accountId: "checking",
      rules: [groceryRule],
      now: "2026-08-03T00:00:00.000Z",
      transaction: {
        transaction_id: "transaction",
        account_id: "provider-checking",
        amount: 42.5,
        date: "2026-08-02",
        name: "KROGER #417",
        merchant_name: "Kroger",
        pending: false,
        personal_finance_category: {
          primary: "FOOD_AND_DRINK",
          detailed: "FOOD_AND_DRINK_GROCERIES",
          confidence_level: "VERY_HIGH",
        },
      },
    });
    expect(result).toMatchObject({
      amount: 42.5,
      type: "expense",
      category: "Groceries",
      categoryId: "groceries",
      envelopeId: "grocery-envelope",
      categorizationStatus: "auto-categorized",
    });
  });

  it("routes provider transfers to review before category rules", () => {
    const result = normalizePlaidTransaction({
      plaidItemId: "item",
      accountId: "checking",
      rules: [],
      transaction: {
        transaction_id: "transfer",
        account_id: "provider-checking",
        amount: 500,
        date: "2026-08-02",
        name: "ONLINE TRANSFER",
        pending: false,
        personal_finance_category: {
          primary: "TRANSFER_OUT",
          detailed: "TRANSFER_OUT_ACCOUNT_TRANSFER",
        },
      },
    });
    expect(result).toMatchObject({
      possibleTransfer: true,
      categorizationStatus: "needs-review",
    });
  });

  it("maps common account types", () => {
    expect(plaidAccountType("depository", "checking")).toBe("checking");
    expect(plaidAccountType("depository", "savings")).toBe("savings");
    expect(plaidAccountType("credit", "credit card")).toBe("credit");
  });
});
