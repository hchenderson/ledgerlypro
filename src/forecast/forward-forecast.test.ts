import { differenceInCalendarDays, format } from "date-fns";
import { describe, expect, it } from "vitest";

import type { Account, RecurringOccurrence, RecurringTransaction, Transaction } from "@/types";
import { confirmRecurringMatch } from "@/lib/recurring-reconciliation";
import { recurringOccurrenceFromSchedule } from "@/lib/recurring";
import { buildForwardForecast } from "./forward-forecast";

const checking: Account = {
  id: "checking",
  name: "Checking",
  type: "checking",
  classification: "asset",
  openingBalance: 1_000,
  currency: "USD",
  isDefault: true,
  createdAt: "2025-01-01T12:00:00.000Z",
};

const savings: Account = {
  id: "savings",
  name: "Savings",
  type: "savings",
  classification: "asset",
  openingBalance: 500,
  currency: "USD",
  createdAt: "2025-01-01T12:00:00.000Z",
};

function localDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12).toISOString();
}

function tx(
  id: string,
  date: string,
  amount: number,
  type: Transaction["type"],
  extras: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    date,
    amount,
    type,
    description: id,
    category: type === "income" ? "Income" : "Operations",
    categoryId: type === "income" ? "income" : "operations",
    accountId: checking.id,
    postingStatus: "posted",
    ...extras,
  };
}

function forecast(
  transactions: Transaction[],
  overrides: Partial<Parameters<typeof buildForwardForecast>[0]> = {},
) {
  return buildForwardForecast({
    transactions,
    recurringTransactions: [],
    accounts: [checking, savings],
    primaryAccountId: checking.id,
    selectedAccountIds: [],
    startDate: new Date(2026, 2, 2), // Monday, March 2
    horizonDays: 7,
    lookbackWeeks: 4,
    minimumActiveWeeks: 4,
    ...overrides,
  });
}

describe("forward forecast contract", () => {
  it("returns zero projected activity and preserves balance with no inputs", () => {
    const result = forecast([], {
      startDate: new Date(2026, 11, 15),
      horizonDays: 90,
    });

    expect(result.series).toHaveLength(90);
    expect(format(result.contract.start, "yyyy-MM-dd")).toBe("2026-12-15");
    expect(format(result.contract.endInclusive, "yyyy-MM-dd")).toBe("2027-03-14");
    expect(differenceInCalendarDays(
      result.contract.endInclusive,
      result.contract.start,
    )).toBe(89);
    expect(result.totals).toEqual({
      income: 0,
      expenses: 0,
      net: 0,
      transactionCount: 0,
    });
    expect(result.openingBalance).toBe(1_500);
    expect(result.projectedEndingBalance).toBe(1_500);
  });

  it("uses one residual fallback rather than multiplying it by unused categories", () => {
    const sparse = [
      tx("one-expense", localDate(2026, 2, 23), 700, "expense", {
        category: "Populated",
        categoryId: "populated",
      }),
    ];
    const result = forecast(sparse, {
      lookbackWeeks: 1,
      minimumActiveWeeks: 4,
    });
    const renamed = forecast(
      sparse.map((transaction) => ({
        ...transaction,
        category: "Renamed but same ID",
      })),
      { lookbackWeeks: 1, minimumActiveWeeks: 4 },
    );

    // Previous implementation applied this $700 global week once for every
    // configured category. Three category choices produced $2,100. The model
    // no longer consumes the category catalog and projects the residual once.
    expect(result.totals.expenses).toBeCloseTo(700, 8);
    expect(result.components.residualEstimated.expenses).toBeCloseTo(700, 8);
    expect(result.diagnostics.residualHistoryLineCount).toBe(1);
    expect(renamed.totals).toEqual(result.totals);
  });

  it("partitions merchant, category, and sparse residual history exactly once", () => {
    const history = [
      tx("acme-1", localDate(2026, 3, 2), 100, "expense", {
        merchantName: "Acme",
        category: "Supplies",
        categoryId: "supplies",
      }),
      tx("acme-2", localDate(2026, 3, 9), 100, "expense", {
        merchantName: "Acme",
        category: "Supplies",
        categoryId: "supplies",
      }),
      tx("grocery-one", localDate(2026, 3, 3), 40, "expense", {
        merchantName: "Grocery One",
        category: "Groceries",
        categoryId: "groceries",
      }),
      tx("grocery-two", localDate(2026, 3, 10), 40, "expense", {
        merchantName: "Grocery Two",
        category: "Groceries",
        categoryId: "groceries",
      }),
      tx("sparse-income", localDate(2026, 3, 6), 400, "income", {
        merchantName: "One-time donor",
        category: "Giving",
        categoryId: "giving",
      }),
    ];
    const result = forecast(history, {
      startDate: new Date(2026, 2, 30),
      minimumActiveWeeks: 2,
    });

    expect(result.components.merchantEstimated.expenses).toBeCloseTo(50, 8);
    expect(result.components.categoryEstimated.expenses).toBeCloseTo(20, 8);
    expect(result.components.residualEstimated.income).toBeCloseTo(100, 8);
    expect(result.totals.income).toBeCloseTo(100, 8);
    expect(result.totals.expenses).toBeCloseTo(70, 8);
    expect(result.totals.net).toBeCloseTo(30, 8);
    expect(result.diagnostics).toMatchObject({
      merchantModelCount: 1,
      categoryModelCount: 1,
      residualHistoryLineCount: 1,
    });

    const shuffled = forecast([...history].reverse(), {
      startDate: new Date(2026, 2, 30),
      minimumActiveWeeks: 2,
    });
    expect(shuffled.totals).toEqual(result.totals);

    const renamedCategory = forecast(
      history.map((transaction) =>
        transaction.categoryId === "groceries"
          ? { ...transaction, category: "Food at home" }
          : transaction,
      ),
      {
        startDate: new Date(2026, 2, 30),
        minimumActiveWeeks: 2,
      },
    );
    expect(renamedCategory.totals).toEqual(result.totals);
  });

  it("uses canonical finalized lines, expands splits once, and respects account scope", () => {
    const history: Transaction[] = [
      tx("split-income", localDate(2026, 1, 5), 1_000, "income", {
        allocationStatus: "complete",
        allocations: [
          { id: "salary", amount: 800, category: "Salary", categoryId: "salary" },
          { id: "gift", amount: 200, category: "Gift", categoryId: "gift" },
        ],
      }),
      tx("checking-expense", localDate(2026, 1, 6), 100, "expense"),
      tx("pending", localDate(2026, 1, 7), 50, "expense", {
        postingStatus: "pending",
        provider: "plaid",
      }),
      tx("removed", localDate(2026, 1, 8), 60, "expense", {
        postingStatus: "removed",
        provider: "plaid",
        providerRemovedAt: localDate(2026, 1, 9),
      }),
      tx("possible-transfer", localDate(2026, 1, 10), 70, "expense", {
        possibleTransfer: true,
        provider: "plaid",
      }),
      tx("transfer-out", localDate(2026, 1, 11), 300, "transfer", {
        transferDirection: "out",
        transferId: "pair",
      }),
      tx("transfer-in", localDate(2026, 1, 11), 300, "transfer", {
        accountId: savings.id,
        transferDirection: "in",
        transferId: "pair",
      }),
      tx("savings-expense", localDate(2026, 1, 12), 80, "expense", {
        accountId: savings.id,
      }),
    ];
    const allAccounts = forecast(history, {
      startDate: new Date(2026, 1, 2),
      minimumActiveWeeks: 99,
    });
    const checkingOnly = forecast(history, {
      startDate: new Date(2026, 1, 2),
      minimumActiveWeeks: 99,
      selectedAccountIds: [checking.id],
    });

    expect(allAccounts.historicalActuals).toHaveLength(4);
    expect(allAccounts.totals.income).toBeCloseTo(250, 8);
    expect(allAccounts.totals.expenses).toBeCloseTo(45, 8);
    expect(allAccounts.openingBalance).toBe(2_250);
    expect(allAccounts.projectedEndingBalance).toBeCloseTo(2_455, 8);

    expect(checkingOnly.totals.income).toBeCloseTo(250, 8);
    expect(checkingOnly.totals.expenses).toBeCloseTo(25, 8);
    expect(checkingOnly.openingBalance).toBe(1_530);
    expect(checkingOnly.projectedEndingBalance).toBeCloseTo(1_755, 8);
  });

  it("excludes explicit legacy expectations from financial history", () => {
    const materialized = tx(
      "system-recurring",
      localDate(2026, 3, 2),
      100,
      "expense",
      { source: "recurring", description: "(Recurring) Rent" },
    );
    const bankActual = tx(
      "plaid-rent",
      localDate(2026, 3, 2),
      100,
      "expense",
      { source: "plaid", merchantName: "Landlord" },
    );
    const schedule: RecurringTransaction = {
      id: "rent",
      description: "Rent",
      amount: 100,
      type: "expense",
      category: "Housing",
      categoryId: "housing",
      accountId: checking.id,
      frequency: "weekly",
      startDate: localDate(2026, 3, 2),
    };
    const result = forecast([materialized, bankActual], {
      recurringTransactions: [schedule],
      startDate: new Date(2026, 2, 30),
      minimumActiveWeeks: 99,
    });

    expect(result.components.scheduled.expenses).toBe(100);
    expect(result.components.residualEstimated.expenses).toBeCloseTo(25, 8);
    expect(result.totals.expenses).toBeCloseTo(125, 8);
    expect(result.diagnostics.excludedMaterializedRecurringLines).toBe(0);
    expect(result.diagnostics.excludedReconciledActualLines).toBe(0);
    expect(result.diagnostics.recurringOverlapNeedsReview).toBe(false);
  });

  it("removes a fulfilled occurrence and its confirmed actual from forecast estimates", () => {
    const schedule: RecurringTransaction = {
      id: "electricity",
      description: "Acme Electric",
      amount: 100,
      type: "expense",
      category: "Utilities",
      categoryId: "utilities",
      accountId: checking.id,
      frequency: "monthly",
      startDate: localDate(2026, 4, 10),
    };
    const baseOccurrence = recurringOccurrenceFromSchedule(
      schedule,
      new Date("2026-04-10T00:00:00.000Z"),
    );
    const bankActual = tx(
      "plaid-electricity",
      localDate(2026, 4, 5),
      103,
      "expense",
      {
        merchantName: "Acme Electric",
        recurringOccurrenceId: baseOccurrence.id,
      },
    );
    const fulfilled = confirmRecurringMatch(
      baseOccurrence,
      bankActual,
      localDate(2026, 4, 5),
    );
    const result = forecast([bankActual], {
      recurringTransactions: [schedule],
      recurringOccurrences: [fulfilled],
      startDate: new Date(2026, 3, 6),
      horizonDays: 7,
      minimumActiveWeeks: 99,
    });

    expect(result.components.scheduled.expenses).toBe(0);
    expect(result.components.residualEstimated.expenses).toBe(0);
    expect(result.totals.expenses).toBe(0);
    expect(result.diagnostics.excludedReconciledActualLines).toBe(1);
    expect(result.openingBalance).toBe(1_397);
    expect(result.projectedEndingBalance).toBe(1_397);
  });

  it("forecasts only the unpaid remainder and excludes skipped occurrences", () => {
    const schedule: RecurringTransaction = {
      id: "rent",
      description: "Rent",
      amount: 100,
      type: "expense",
      category: "Housing",
      categoryId: "housing",
      accountId: checking.id,
      frequency: "monthly",
      startDate: localDate(2026, 4, 10),
    };
    const base = recurringOccurrenceFromSchedule(
      schedule,
      new Date("2026-04-10T00:00:00.000Z"),
    );
    const partial: RecurringOccurrence = {
      ...base,
      status: "partially-fulfilled",
      matchedAmount: 40,
      remainingAmount: 60,
      matches: [{
        transactionId: "partial",
        amount: 40,
        postingDate: localDate(2026, 4, 5),
        confirmedAt: localDate(2026, 4, 5),
        status: "confirmed",
      }],
    };
    const partialResult = forecast([], {
      recurringTransactions: [schedule],
      recurringOccurrences: [partial],
      startDate: new Date(2026, 3, 6),
      horizonDays: 7,
    });
    const skippedResult = forecast([], {
      recurringTransactions: [schedule],
      recurringOccurrences: [{ ...base, status: "skipped", skippedAt: localDate(2026, 4, 1) }],
      startDate: new Date(2026, 3, 6),
      horizonDays: 7,
    });
    const exceptionResult = forecast([], {
      recurringTransactions: [schedule],
      recurringOccurrences: [{
        ...base,
        status: "exception",
        exceptionReason: "linked-provider-transaction-removed",
      }],
      startDate: new Date(2026, 3, 6),
      horizonDays: 7,
    });

    expect(partialResult.components.scheduled.expenses).toBe(60);
    expect(skippedResult.components.scheduled.expenses).toBe(0);
    expect(exceptionResult.components.scheduled.expenses).toBe(100);
    expect(exceptionResult.diagnostics.recurringOverlapNeedsReview).toBe(true);
  });

  it("keeps persisted occurrence snapshots after schedule edits or deletion", () => {
    const original: RecurringTransaction = {
      id: "insurance",
      description: "Original insurance",
      amount: 100,
      type: "expense",
      category: "Insurance",
      categoryId: "insurance",
      accountId: checking.id,
      frequency: "monthly",
      startDate: localDate(2026, 4, 10),
    };
    const persisted = recurringOccurrenceFromSchedule(
      original,
      new Date("2026-04-10T00:00:00.000Z"),
    );
    const edited: RecurringTransaction = {
      ...original,
      amount: 175,
      description: "Edited insurance",
      startDate: localDate(2026, 5, 10),
    };
    const afterEdit = forecast([], {
      recurringTransactions: [edited],
      recurringOccurrences: [persisted],
      startDate: new Date(2026, 3, 6),
      horizonDays: 7,
    });
    const afterDeletion = forecast([], {
      recurringTransactions: [],
      recurringOccurrences: [persisted],
      startDate: new Date(2026, 3, 6),
      horizonDays: 7,
    });

    expect(afterEdit.recurringFuture).toHaveLength(1);
    expect(afterEdit.recurringFuture[0]).toMatchObject({
      amount: 100,
      expectedAmount: 100,
      description: "(Forecast) Original insurance",
    });
    expect(afterDeletion.components.scheduled.expenses).toBe(100);
  });

  it("keeps reconciled occurrences inside account scope and the exact horizon", () => {
    const schedule: RecurringTransaction = {
      id: "savings-bill",
      description: "Savings bill",
      amount: 25,
      type: "expense",
      category: "Bills",
      accountId: savings.id,
      frequency: "monthly",
      startDate: localDate(2026, 4, 12),
    };
    const persisted = recurringOccurrenceFromSchedule(
      schedule,
      new Date("2026-04-12T00:00:00.000Z"),
    );
    const outsideScope = forecast([], {
      recurringTransactions: [schedule],
      recurringOccurrences: [persisted],
      selectedAccountIds: [checking.id],
      startDate: new Date(2026, 3, 6),
      horizonDays: 7,
    });
    const endsBeforeDue = forecast([], {
      recurringTransactions: [schedule],
      recurringOccurrences: [persisted],
      startDate: new Date(2026, 3, 6),
      horizonDays: 6,
    });

    expect(outsideScope.recurringFuture).toEqual([]);
    expect(endsBeforeDue.recurringFuture).toEqual([]);
  });

  it("keeps income and expense separate so offsetting mistakes cannot hide", () => {
    const result = forecast([
      tx("income", localDate(2026, 2, 23), 350, "income"),
      tx("expense", localDate(2026, 2, 24), 140, "expense"),
    ], {
      lookbackWeeks: 1,
      minimumActiveWeeks: 99,
    });

    expect(result.totals.income).toBeCloseTo(350, 8);
    expect(result.totals.expenses).toBeCloseTo(140, 8);
    expect(result.totals.net).toBeCloseTo(210, 8);
    expect(result.openingBalance).toBeCloseTo(1_710, 8);
    expect(result.projectedEndingBalance).toBeCloseTo(1_920, 8);
    expect(result.components.residualEstimated.net).toBeCloseTo(210, 8);
  });

  it("handles leap days and includes only the exact horizon boundaries", () => {
    const yearly: RecurringTransaction = {
      id: "leap",
      description: "Leap-day commitment",
      amount: 25,
      type: "expense",
      category: "Annual",
      categoryId: "annual",
      accountId: checking.id,
      frequency: "yearly",
      startDate: localDate(2028, 2, 29),
    };
    const leapResult = forecast([], {
      recurringTransactions: [yearly],
      startDate: new Date(2029, 1, 28),
      horizonDays: 2,
    });
    expect(leapResult.recurringFuture).toHaveLength(1);
    expect(format(new Date(leapResult.recurringFuture[0].date), "yyyy-MM-dd")).toBe("2029-02-28");

    const leapHorizon = forecast([], {
      startDate: new Date(2028, 1, 29),
      horizonDays: 90,
    });
    expect(leapHorizon.series).toHaveLength(90);
    expect(format(leapHorizon.contract.endInclusive, "yyyy-MM-dd")).toBe("2028-05-28");
  });

  it("supports a rolling-origin check without reading future observations", () => {
    const weeklyHistory = [0, 1, 2, 3, 4, 5].flatMap((week) => [
      tx(
        `weekly-income-${week}`,
        localDate(2026, 3, 2 + week * 7),
        100,
        "income",
        { merchantName: "Payroll" },
      ),
      tx(
        `weekly-expense-${week}`,
        localDate(2026, 3, 3 + week * 7),
        40,
        "expense",
        { merchantName: "Weekly vendor" },
      ),
    ]);

    for (const startDate of [new Date(2026, 2, 30), new Date(2026, 3, 6)]) {
      const result = forecast(weeklyHistory, {
        startDate,
        horizonDays: 7,
        lookbackWeeks: 4,
        minimumActiveWeeks: 4,
      });
      expect(result.totals.income).toBeCloseTo(100, 8);
      expect(result.totals.expenses).toBeCloseTo(40, 8);
      expect(result.totals.net).toBeCloseTo(60, 8);
      expect(
        result.historicalActuals.every(
          (transaction) =>
            new Date(transaction.date) < result.contract.start,
        ),
      ).toBe(true);
    }
  });
});
