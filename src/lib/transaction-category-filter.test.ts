import { describe, expect, it } from "vitest";

import type { Category, Transaction } from "@/types";
import {
  ALL_TRANSACTION_CATEGORIES,
  TRANSFER_TRANSACTION_CATEGORY,
  buildTransactionCategoryOptions,
  filterTransactionsByCategory,
} from "./transaction-category-filter";

const categories: Category[] = [
  {
    id: "building",
    name: "Building",
    type: "expense",
    subCategories: [
      {
        id: "general-building",
        name: "General Building",
        subCategories: [
          {
            id: "building-insurance",
            name: "Building Insurance",
          },
          { id: "building-repairs", name: "Repairs" },
        ],
      },
      { id: "utilities", name: "Utilities" },
    ],
  },
  {
    id: "vehicles",
    name: "Vehicles",
    type: "expense",
    subCategories: [{ id: "vehicle-repairs", name: "Repairs" }],
  },
  {
    id: "uncategorized",
    name: "Uncategorized",
    type: "expense",
  },
];

function transaction(
  id: string,
  categoryId: string | undefined,
  category: string,
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    date: "2026-11-05T12:00:00.000Z",
    description: id,
    amount: 100,
    type: "expense",
    category,
    categoryId,
    accountId: "operating",
    postingStatus: "posted",
    ...overrides,
  };
}

describe("Transactions category filter", () => {
  const hierarchyTransactions = [
    transaction("building-direct", "building", "Building"),
    transaction("general-direct", "general-building", "General Building"),
    transaction("insurance", "building-insurance", "Building Insurance"),
    transaction("building-repair", "building-repairs", "Repairs"),
    transaction("utilities", "utilities", "Utilities"),
    transaction("vehicle-repair", "vehicle-repairs", "Repairs"),
  ];

  it.each([
    [
      "building",
      [
        "building-direct",
        "general-direct",
        "insurance",
        "building-repair",
        "utilities",
      ],
    ],
    [
      "general-building",
      ["general-direct", "insurance", "building-repair"],
    ],
    ["building-insurance", ["insurance"]],
  ])(
    "includes only the selected %s category and its descendants",
    (selectedCategoryId, expectedIds) => {
      expect(
        filterTransactionsByCategory(
          hierarchyTransactions,
          selectedCategoryId,
          categories,
        ).map((entry) => entry.id),
      ).toEqual(expectedIds);
    },
  );

  it("uses IDs and path labels to distinguish repeated category names", () => {
    const options = buildTransactionCategoryOptions(categories);

    expect(options.filter((option) => option.label.endsWith("Repairs"))).toEqual([
      {
        value: "building-repairs",
        label: "Expense · Building > General Building > Repairs",
      },
      {
        value: "vehicle-repairs",
        label: "Expense · Vehicles > Repairs",
      },
    ]);
    expect(
      filterTransactionsByCategory(
        hierarchyTransactions,
        "building-repairs",
        categories,
      ).map((entry) => entry.id),
    ).toEqual(["building-repair"]);
    expect(
      filterTransactionsByCategory(
        hierarchyTransactions,
        "vehicle-repairs",
        categories,
      ).map((entry) => entry.id),
    ).toEqual(["vehicle-repair"]);

    const ambiguousLegacyRecord = transaction(
      "legacy-repair",
      undefined,
      "Repairs",
    );
    expect(
      filterTransactionsByCategory(
        [ambiguousLegacyRecord],
        "building-repairs",
        categories,
      ),
    ).toEqual([]);
    expect(
      filterTransactionsByCategory(
        [ambiguousLegacyRecord],
        "vehicle-repairs",
        categories,
      ),
    ).toEqual([]);
  });

  it("matches split allocations but returns the source transaction once", () => {
    const split = transaction(
      "split",
      undefined,
      "Split transaction",
      {
        amount: 100,
        allocations: [
          {
            id: "insurance-line",
            amount: 60,
            category: "Building Insurance",
            categoryId: "building-insurance",
          },
          {
            id: "repair-line",
            amount: 40,
            category: "Repairs",
            categoryId: "building-repairs",
          },
        ],
      },
    );

    expect(
      filterTransactionsByCategory([split], "building", categories).map(
        (entry) => entry.id,
      ),
    ).toEqual(["split"]);
    expect(
      filterTransactionsByCategory(
        [split],
        "building-insurance",
        categories,
      ).map((entry) => entry.id),
    ).toEqual(["split"]);
  });

  it("preserves All Categories, Transfer, and Uncategorized behavior", () => {
    const assigned = transaction(
      "assigned-uncategorized",
      "uncategorized",
      "Uncategorized",
    );
    const missingId = transaction(
      "missing-id-uncategorized",
      undefined,
      "Uncategorized",
    );
    const staleId = transaction(
      "stale-id-uncategorized",
      "deleted-category",
      "Uncategorized",
    );
    const transfer = transaction("transfer", undefined, "Transfer", {
      type: "transfer",
      transferDirection: "out",
    });
    const transactions = [
      assigned,
      missingId,
      staleId,
      transfer,
    ];

    expect(
      filterTransactionsByCategory(
        transactions,
        ALL_TRANSACTION_CATEGORIES,
        categories,
      ).map((entry) => entry.id),
    ).toEqual(transactions.map((entry) => entry.id));
    expect(
      filterTransactionsByCategory(
        transactions,
        "uncategorized",
        categories,
      ).map((entry) => entry.id),
    ).toEqual([
      "assigned-uncategorized",
      "missing-id-uncategorized",
      "stale-id-uncategorized",
    ]);
    expect(
      filterTransactionsByCategory(
        transactions,
        TRANSFER_TRANSACTION_CATEGORY,
        categories,
      ).map((entry) => entry.id),
    ).toEqual(["transfer"]);
  });

  it("does not treat an incomplete split remainder as Uncategorized", () => {
    const incompleteSplit = transaction(
      "incomplete-split",
      undefined,
      "Split transaction",
      {
        amount: 100,
        allocations: [
          {
            id: "partial",
            amount: 40,
            category: "Building Insurance",
            categoryId: "building-insurance",
          },
        ],
      },
    );

    expect(
      filterTransactionsByCategory(
        [incompleteSplit],
        "uncategorized",
        categories,
      ),
    ).toEqual([]);
  });

  it("composes with existing search and upstream account filters", () => {
    const transactions = [
      transaction("target", "building-insurance", "Building Insurance", {
        description: "Staples building policy",
        accountId: "savings",
      }),
      transaction("wrong-search", "building-insurance", "Building Insurance", {
        description: "Atlas Studio",
        accountId: "savings",
      }),
      transaction("wrong-account", "building-insurance", "Building Insurance", {
        description: "Staples supplies",
        accountId: "operating",
      }),
      transaction("wrong-category", "vehicle-repairs", "Repairs", {
        description: "Staples vehicle repair",
        accountId: "savings",
      }),
    ];
    const existingFilters = transactions.filter(
      (entry) =>
        entry.description.toLocaleLowerCase().includes("staples") &&
        entry.accountId === "savings",
    );

    expect(
      filterTransactionsByCategory(
        existingFilters,
        "building",
        categories,
      ).map((entry) => entry.id),
    ).toEqual(["target"]);
  });
});
