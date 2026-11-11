import { describe, expect, it } from "vitest";

import {
  calculateAccountBalanceAsOf,
  isFinancialTransaction,
} from "./accounts";
import { calculateBudgetDetails } from "./budget-analytics";
import {
  computeDesignatedFundResult,
  computeOperatingSummary,
} from "./designated-funds";
import { financialReportingTransactions } from "./financial-summary";
import { buildForwardForecast } from "@/forecast/forward-forecast";
import { confirmRecurringMatch } from "./recurring-reconciliation";
import { recurringOccurrenceFromSchedule } from "./recurring";
import { buildRefundLink } from "./refunds";
import { buildReportCsvRows, summarizeReportCsvRows } from "./report-export";
import {
  computeReportAnalytics,
  computeReportBudgets,
  type ReportFilterConfiguration,
} from "./report-analytics";
import type {
  Account,
  Budget,
  Category,
  DesignatedFund,
  Transaction,
} from "@/types";

/**
 * A deliberately small ledger whose expected values were calculated by hand.
 * Keep the constants below explicit: they are the independent oracle for the
 * calculation functions, not values derived from Ledgerly helpers.
 */
const EXPECTED = {
  january: {
    income: 4_000,
    expenses: 500,
    net: 3_500,
    transactionCount: 7,
  },
  transfersMoved: 300,
  checkingJanuary: {
    income: 4_000,
    expenses: 420,
    net: 3_580,
    transactionCount: 6,
  },
  balancesAtJanuary31: {
    checking: 4_115,
    savings: 720,
  },
  budgetCards: {
    operationsParent: 350,
    groceriesChild: 190,
    missionSent: 150,
    yearlyOperations: 420,
  },
  reportBudgetRows: {
    operationsParent: 160,
    groceriesChild: 190,
    missionSent: 150,
    total: 500,
  },
  checkingBudgetCards: {
    operationsParent: 270,
    groceriesChild: 190,
    missionSent: 150,
    reportBudgetTotal: 420,
  },
  designated: {
    openingBalance: 700,
    received: 200,
    spent: 150,
    endingBalance: 750,
  },
  operating: {
    income: 3_800,
    expenses: 350,
    net: 3_450,
  },
  forecastWeek: {
    income: 800,
    expenses: 132,
    net: 668,
    openingBalance: 4_765,
    endingBalance: 5_433,
  },
} as const;

const categories: Category[] = [
  {
    id: "income",
    name: "Income",
    type: "income",
    subCategories: [
      { id: "salary", name: "Salary", subCategories: [] },
      { id: "general-giving", name: "General Giving", subCategories: [] },
      { id: "mission-in", name: "Mission Support", subCategories: [] },
    ],
  },
  {
    id: "operations",
    name: "Operations",
    type: "expense",
    subCategories: [
      { id: "groceries", name: "Groceries", subCategories: [] },
      { id: "utilities", name: "Utilities", subCategories: [] },
    ],
  },
  {
    id: "ministry",
    name: "Ministry",
    type: "expense",
    subCategories: [
      { id: "mission-out", name: "Mission Sent", subCategories: [] },
    ],
  },
];

const checking: Account = {
  id: "checking",
  name: "Checking",
  type: "checking",
  classification: "asset",
  openingBalance: 1_000,
  currency: "USD",
  isDefault: true,
  createdAt: "2025-01-01T00:00:00.000Z",
};

const savings: Account = {
  id: "savings",
  name: "Savings",
  type: "savings",
  classification: "asset",
  openingBalance: 500,
  currency: "USD",
  createdAt: "2025-01-01T00:00:00.000Z",
};

const budgets: Budget[] = [
  {
    id: "operations-budget",
    categoryId: "operations",
    amount: 500,
    period: "monthly",
    year: 2026,
  },
  {
    id: "groceries-budget",
    categoryId: "groceries",
    amount: 300,
    period: "monthly",
    year: 2026,
  },
  {
    id: "mission-budget",
    categoryId: "mission-out",
    amount: 200,
    period: "monthly",
    year: 2026,
  },
];

const designatedFund: DesignatedFund = {
  id: "missions",
  name: "Missionary Support",
  incomeCategoryIds: ["mission-in"],
  expenseCategoryIds: ["mission-out"],
  openingBalance: 700,
  openingBalanceDate: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function transaction(
  id: string,
  date: string,
  amount: number,
  type: Transaction["type"],
  category: string,
  categoryId: string | undefined,
  accountId: string,
  extras: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    date,
    amount,
    type,
    category,
    categoryId,
    accountId,
    description: id,
    postingStatus: "posted",
    ...extras,
  };
}

const transactions: Transaction[] = [
  // Outside the report period but before the balance cutoff.
  transaction(
    "prior-expense",
    "2025-12-31T12:00:00.000Z",
    90,
    "expense",
    "Groceries",
    "groceries",
    checking.id,
  ),
  // First-day boundary: included.
  transaction(
    "salary",
    "2026-01-01T12:00:00.000Z",
    3_000,
    "income",
    "Salary",
    "salary",
    checking.id,
  ),
  transaction(
    "split-income",
    "2026-01-05T12:00:00.000Z",
    1_000,
    "income",
    "Split transaction",
    undefined,
    checking.id,
    {
      allocationStatus: "complete",
      allocations: [
        {
          id: "general",
          amount: 800,
          category: "General Giving",
          categoryId: "general-giving",
        },
        {
          id: "mission",
          amount: 200,
          category: "Mission Support",
          categoryId: "mission-in",
        },
      ],
    },
  ),
  transaction(
    "groceries-posted",
    "2026-01-10T12:00:00.000Z",
    120,
    "expense",
    "Groceries",
    "groceries",
    checking.id,
  ),
  transaction(
    "operations-direct",
    "2026-01-12T12:00:00.000Z",
    50,
    "expense",
    "Operations",
    "operations",
    checking.id,
  ),
  transaction(
    "transfer-out",
    "2026-01-15T12:00:00.000Z",
    300,
    "transfer",
    "Transfer",
    undefined,
    checking.id,
    {
      transferId: "checking-to-savings",
      transferDirection: "out",
      linkedTransactionId: "transfer-in",
    },
  ),
  transaction(
    "transfer-in",
    "2026-01-15T12:00:00.000Z",
    300,
    "transfer",
    "Transfer",
    undefined,
    savings.id,
    {
      transferId: "checking-to-savings",
      transferDirection: "in",
      linkedTransactionId: "transfer-out",
    },
  ),
  transaction(
    "utilities-savings",
    "2026-01-20T12:00:00.000Z",
    80,
    "expense",
    "Utilities",
    "utilities",
    savings.id,
  ),
  transaction(
    "split-expense",
    "2026-01-22T12:00:00.000Z",
    100,
    "expense",
    "Split transaction",
    undefined,
    checking.id,
    {
      allocationStatus: "complete",
      allocations: [
        {
          id: "food",
          amount: 70,
          category: "Groceries",
          categoryId: "groceries",
        },
        {
          id: "power",
          amount: 30,
          category: "Utilities",
          categoryId: "utilities",
        },
      ],
    },
  ),
  transaction(
    "pending-groceries",
    "2026-01-23T12:00:00.000Z",
    40,
    "expense",
    "Groceries",
    "groceries",
    checking.id,
    { provider: "plaid", postingStatus: "pending" },
  ),
  transaction(
    "removed-groceries",
    "2026-01-24T12:00:00.000Z",
    60,
    "expense",
    "Groceries",
    "groceries",
    checking.id,
    {
      provider: "plaid",
      postingStatus: "removed",
      providerRemovedAt: "2026-01-25T12:00:00.000Z",
    },
  ),
  transaction(
    "possible-transfer",
    "2026-01-25T12:00:00.000Z",
    75,
    "expense",
    "Groceries",
    "groceries",
    checking.id,
    { provider: "plaid", possibleTransfer: true },
  ),
  // Last-day boundary: included.
  transaction(
    "mission-sent",
    "2026-01-31T12:00:00.000Z",
    150,
    "expense",
    "Mission Sent",
    "mission-out",
    checking.id,
  ),
  // Outside both the report period and January balance cutoff.
  transaction(
    "future-expense",
    "2026-02-01T12:00:00.000Z",
    70,
    "expense",
    "Groceries",
    "groceries",
    checking.id,
  ),
];

const januaryRange = {
  from: new Date(2026, 0, 1),
  to: new Date(2026, 0, 31),
};

const reportFilters: ReportFilterConfiguration = {
  accountIds: [],
  transactionTypes: ["income", "expense"],
  includedCategoryKeys: [],
  excludedCategoryKeys: [],
  includePending: false,
  includeTransfers: true,
};

function rowsById(rows: Array<{ budgetId: string; actual: number }>) {
  return new Map(rows.map((row) => [row.budgetId, row.actual]));
}

describe("golden financial ledger", () => {
  it("applies the canonical financial inclusion predicate", () => {
    expect(isFinancialTransaction(transactions.find((item) => item.id === "groceries-posted")!)).toBe(true);
    expect(isFinancialTransaction(transactions.find((item) => item.id === "pending-groceries")!)).toBe(false);
    expect(isFinancialTransaction(transactions.find((item) => item.id === "removed-groceries")!)).toBe(false);
    expect(isFinancialTransaction(transactions.find((item) => item.id === "possible-transfer")!)).toBe(false);
    expect(isFinancialTransaction(transactions.find((item) => item.id === "transfer-out")!)).toBe(false);
  });

  it("reconciles report totals, period boundaries, splits, and transfers", () => {
    const report = computeReportAnalytics(
      transactions,
      januaryRange,
      reportFilters,
      categories,
      [checking, savings],
      "month",
      checking.id,
    );

    expect(report.summary).toMatchObject(EXPECTED.january);
    expect(report.transfers).toMatchObject({
      totalMoved: EXPECTED.transfersMoved,
      count: 1,
    });
    expect(report.transactions.map((item) => item.id)).not.toContain(
      "prior-expense",
    );
    expect(report.transactions.map((item) => item.id)).not.toContain(
      "future-expense",
    );
    expect(report.transactions.map((item) => item.id)).not.toContain(
      "pending-groceries",
    );
    expect(report.transactions.map((item) => item.id)).not.toContain(
      "removed-groceries",
    );
    expect(report.transactions.map((item) => item.id)).not.toContain(
      "possible-transfer",
    );
    expect(report.financialTransactions).toHaveLength(9);
  });

  it("respects account scope without changing global category semantics", () => {
    const checkingReport = computeReportAnalytics(
      transactions,
      januaryRange,
      { ...reportFilters, accountIds: [checking.id] },
      categories,
      [checking, savings],
      "month",
      checking.id,
    );

    expect(checkingReport.summary).toMatchObject(EXPECTED.checkingJanuary);
    expect(
      checkingReport.transactions.every(
        (item) => item.accountId === checking.id,
      ),
    ).toBe(true);
  });

  it("keeps balance activity separate from financial reporting activity", () => {
    expect(
      calculateAccountBalanceAsOf(checking, transactions, "2026-01-31"),
    ).toBe(EXPECTED.balancesAtJanuary31.checking);
    expect(
      calculateAccountBalanceAsOf(savings, transactions, "2026-01-31"),
    ).toBe(EXPECTED.balancesAtJanuary31.savings);

    const financialIds = financialReportingTransactions(transactions).map(
      (item) => item.id,
    );
    expect(financialIds).not.toContain("possible-transfer");
    expect(financialIds).not.toContain("transfer-out");
    expect(financialIds).not.toContain("transfer-in");
  });

  it("uses canonical inclusion and split lines for budget cards", () => {
    const details = calculateBudgetDetails(
      {
        activeBudgets: budgets,
        transactions,
        categories,
        forDate: new Date(2026, 0, 1),
      },
      2026,
    );
    const spent = new Map(details.map((detail) => [detail.id, detail.spent]));

    expect(spent.get("operations-budget")).toBe(
      EXPECTED.budgetCards.operationsParent,
    );
    expect(spent.get("groceries-budget")).toBe(
      EXPECTED.budgetCards.groceriesChild,
    );
    expect(spent.get("mission-budget")).toBe(
      EXPECTED.budgetCards.missionSent,
    );
  });

  it("keeps account scope caller-defined for budget cards", () => {
    const checkingTransactions = transactions.filter(
      (item) => item.accountId === checking.id,
    );
    const details = calculateBudgetDetails(
      {
        activeBudgets: budgets,
        transactions: checkingTransactions,
        categories,
        forDate: new Date(2026, 0, 1),
      },
      2026,
    );
    const spent = new Map(details.map((detail) => [detail.id, detail.spent]));

    expect(spent.get("operations-budget")).toBe(
      EXPECTED.checkingBudgetCards.operationsParent,
    );
    expect(spent.get("groceries-budget")).toBe(
      EXPECTED.checkingBudgetCards.groceriesChild,
    );
    expect(spent.get("mission-budget")).toBe(
      EXPECTED.checkingBudgetCards.missionSent,
    );

    const checkingReport = computeReportAnalytics(
      transactions,
      januaryRange,
      { ...reportFilters, accountIds: [checking.id] },
      categories,
      [checking, savings],
      "month",
      checking.id,
    );
    const checkingReportBudgets = computeReportBudgets(
      budgets,
      categories,
      checkingReport.transactions,
      januaryRange,
      reportFilters,
    );
    expect(checkingReportBudgets.actual).toBe(
      EXPECTED.checkingBudgetCards.reportBudgetTotal,
    );
    expect(checkingReportBudgets.actual).toBe(
      checkingReport.summary.expenses,
    );
  });

  it("respects monthly and yearly budget periods", () => {
    const [yearlyDetails] = calculateBudgetDetails(
      {
        activeBudgets: [
          {
            id: "yearly-operations-budget",
            categoryId: "operations",
            amount: 6_000,
            period: "yearly",
            year: 2026,
          },
        ],
        transactions,
        categories,
        forDate: new Date(2026, 0, 1),
      },
      2026,
    );

    expect(yearlyDetails.spent).toBe(
      EXPECTED.budgetCards.yearlyOperations,
    );
  });

  it("reconciles Reports budget totals without summing overlapping cards", () => {
    const report = computeReportAnalytics(
      transactions,
      januaryRange,
      reportFilters,
      categories,
      [checking, savings],
      "month",
      checking.id,
    );
    const reportBudgets = computeReportBudgets(
      budgets,
      categories,
      report.transactions,
      januaryRange,
      reportFilters,
    );
    const actual = rowsById(reportBudgets.rows);

    expect(actual.get("operations-budget")).toBe(
      EXPECTED.reportBudgetRows.operationsParent,
    );
    expect(actual.get("groceries-budget")).toBe(
      EXPECTED.reportBudgetRows.groceriesChild,
    );
    expect(actual.get("mission-budget")).toBe(
      EXPECTED.reportBudgetRows.missionSent,
    );
    expect(reportBudgets.actual).toBe(EXPECTED.reportBudgetRows.total);
    expect(reportBudgets.actual).toBe(report.summary.expenses);
  });

  it("reconciles designated and operating activity", () => {
    expect(
      computeDesignatedFundResult(
        designatedFund,
        transactions,
        januaryRange,
      ),
    ).toMatchObject(EXPECTED.designated);
    expect(
      computeOperatingSummary(
        [designatedFund],
        transactions,
        januaryRange,
      ),
    ).toMatchObject(EXPECTED.operating);
  });

  it("extends the golden ledger through the deterministic forecast kernel", () => {
    const result = buildForwardForecast({
      transactions,
      recurringTransactions: [],
      accounts: [checking, savings],
      primaryAccountId: checking.id,
      selectedAccountIds: [],
      startDate: new Date(2026, 1, 2),
      horizonDays: 7,
      lookbackWeeks: 5,
      minimumActiveWeeks: 99,
    });

    expect(result.totals.income).toBeCloseTo(
      EXPECTED.forecastWeek.income,
      8,
    );
    expect(result.totals.expenses).toBeCloseTo(
      EXPECTED.forecastWeek.expenses,
      8,
    );
    expect(result.totals.net).toBeCloseTo(EXPECTED.forecastWeek.net, 8);
    expect(result.openingBalance).toBe(
      EXPECTED.forecastWeek.openingBalance,
    );
    expect(result.projectedEndingBalance).toBeCloseTo(
      EXPECTED.forecastWeek.endingBalance,
      8,
    );
  });

  it("counts a confirmed $103 actual once for a $100 recurring expectation", () => {
    const recurringSchedule = {
      id: "electricity-schedule",
      description: "Acme Electric",
      amount: 100,
      type: "expense" as const,
      category: "Utilities",
      categoryId: "utilities",
      accountId: checking.id,
      frequency: "monthly" as const,
      startDate: "2026-04-10T00:00:00.000Z",
    };
    const expectedOccurrence = recurringOccurrenceFromSchedule(
      recurringSchedule,
      new Date("2026-04-10T00:00:00.000Z"),
      "2026-04-01T12:00:00.000Z",
    );
    const legacyExpectation = transaction(
      expectedOccurrence.id,
      expectedOccurrence.originalDueDate,
      100,
      "expense",
      "Utilities",
      "utilities",
      checking.id,
      {
        source: "recurring",
        recurringTransactionId: recurringSchedule.id,
        recurringExpectationOnly: true,
      },
    );
    const postedActual = transaction(
      "plaid-electricity-103",
      "2026-04-05T12:00:00.000Z",
      103,
      "expense",
      "Utilities",
      "utilities",
      checking.id,
      {
        source: "plaid",
        provider: "plaid",
        merchantName: "Acme Electric",
        recurringOccurrenceId: expectedOccurrence.id,
        recurringOriginalDueDate: expectedOccurrence.originalDueDate,
        recurringExpectedAmount: 100,
        recurringReconciliationStatus: "confirmed",
      },
    );
    const fulfilledOccurrence = confirmRecurringMatch(
      expectedOccurrence,
      postedActual,
      "2026-04-05T13:00:00.000Z",
    );
    const reconciledLedger = [legacyExpectation, postedActual];
    const aprilRange = {
      from: new Date(2026, 3, 1),
      to: new Date(2026, 3, 30),
    };
    const report = computeReportAnalytics(
      reconciledLedger,
      aprilRange,
      reportFilters,
      categories,
      [checking],
      "month",
      checking.id,
    );
    const [budget] = calculateBudgetDetails(
      {
        activeBudgets: [{
          id: "utilities-april",
          categoryId: "utilities",
          amount: 500,
          period: "monthly",
          year: 2026,
        }],
        transactions: reconciledLedger,
        categories,
        forDate: new Date(2026, 3, 1),
      },
      2026,
    );
    const forecast = buildForwardForecast({
      transactions: reconciledLedger,
      recurringTransactions: [recurringSchedule],
      recurringOccurrences: [fulfilledOccurrence],
      accounts: [checking],
      primaryAccountId: checking.id,
      selectedAccountIds: [],
      startDate: new Date(2026, 3, 6),
      horizonDays: 7,
      lookbackWeeks: 4,
      minimumActiveWeeks: 99,
    });

    // Independent oracle: $1,000 opening - one $103 actual = $897. The $100
    // expectation is traceability/forecast data, not a second ledger expense.
    expect(financialReportingTransactions(reconciledLedger)).toHaveLength(1);
    expect(report.summary).toMatchObject({
      income: 0,
      expenses: 103,
      net: -103,
      transactionCount: 1,
    });
    expect(budget.spent).toBe(103);
    expect(calculateAccountBalanceAsOf(checking, reconciledLedger, "2026-04-30")).toBe(897);
    expect(forecast.components.scheduled.expenses).toBe(0);
    expect(forecast.components.residualEstimated.expenses).toBe(0);
    expect(forecast.openingBalance).toBe(897);
    expect(forecast.projectedEndingBalance).toBe(897);
  });

  it("treats a linked later-period refund as an account credit and negative expense", () => {
    const refundCategory: Category[] = [{
      id: "supplies",
      name: "Supplies",
      type: "expense",
    }];
    const refundAccount: Account = {
      id: "refund-checking",
      name: "Checking",
      type: "checking",
      classification: "asset",
      openingBalance: 1_000,
      currency: "USD",
      isDefault: true,
      createdAt: "2025-01-01",
    };
    const purchase: Transaction = {
      id: "purchase",
      date: "2025-12-20",
      ledgerDate: "2025-12-20",
      description: "Supplies",
      amount: 100,
      amountMinor: 10_000,
      currency: "USD",
      type: "expense",
      category: "Supplies",
      categoryId: "supplies",
      accountId: refundAccount.id,
      postingStatus: "posted",
    };
    const credit: Transaction = {
      id: "credit",
      date: "2026-01-05",
      ledgerDate: "2026-01-05",
      description: "Merchant credit",
      amount: 40,
      amountMinor: 4_000,
      currency: "USD",
      type: "income",
      category: "Uncategorized",
      accountId: refundAccount.id,
      postingStatus: "posted",
    };
    const linkedRefund = buildRefundLink({ refund: credit, original: purchase, existingRefunds: [] });
    const januaryRange = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    const report = computeReportAnalytics(
      [purchase, linkedRefund],
      januaryRange,
      reportFilters,
      refundCategory,
      [refundAccount],
      "month",
      refundAccount.id,
    );
    const [budget] = calculateBudgetDetails({
      activeBudgets: [{ id: "supplies-2026", categoryId: "supplies", amount: 500, period: "yearly", year: 2026 }],
      transactions: [purchase, linkedRefund],
      categories: refundCategory,
      forDate: new Date(2026, 0, 1),
    }, 2026);
    const rows = buildReportCsvRows(financialReportingTransactions([linkedRefund]), () => "Checking");

    // Independent oracle: $1,000 - $100 + $40 = $940. In January the refund
    // produces $0 income and -$40 net spending in the original category.
    expect(report.summary).toMatchObject({ income: 0, expenses: -40, net: 40, transactionCount: 1 });
    expect(budget.spent).toBe(-40);
    expect(calculateAccountBalanceAsOf(refundAccount, [purchase, linkedRefund], "2026-01-31")).toBe(940);
    expect(rows[0]).toMatchObject({ Type: "expense", CategoryId: "supplies", Amount: -40 });
    expect(summarizeReportCsvRows(rows)).toEqual({ income: 0, expenses: -40, net: 40 });
  });
});
