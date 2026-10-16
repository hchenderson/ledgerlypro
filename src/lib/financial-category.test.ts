import { describe, expect, it } from "vitest";

import {
  buildFinancialCategoryOptions,
  financialCategoryPathKeys,
} from "./financial-category";
import type { Category, Transaction } from "@/types";

const categories: Category[] = [
  {
    id: "housing",
    name: "Housing",
    type: "expense",
    subCategories: [
      {
        id: "utilities",
        name: "Utilities",
        subCategories: [
          { id: "electric", name: "Electric", subCategories: [] },
        ],
      },
    ],
  },
];

describe("financial category filters", () => {
  it("builds choices for every category depth with full path labels", () => {
    expect(buildFinancialCategoryOptions(categories)).toEqual(
      expect.arrayContaining([
        { value: "expense:housing", label: "Expense · Housing" },
        {
          value: "expense:utilities",
          label: "Expense · Housing > Utilities",
        },
        {
          value: "expense:electric",
          label: "Expense · Housing > Utilities > Electric",
        },
      ]),
    );
  });

  it("returns every ancestor key for a nested transaction", () => {
    const transaction: Transaction = {
      id: "power",
      date: "2026-01-05",
      description: "Power bill",
      amount: 100,
      type: "expense",
      category: "Electric",
      categoryId: "electric",
    };

    expect(financialCategoryPathKeys(transaction, categories)).toEqual([
      "expense:housing",
      "expense:utilities",
      "expense:electric",
    ]);
  });
});
