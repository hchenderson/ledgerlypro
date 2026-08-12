import { describe, expect, it } from "vitest";
import { buildReportPdfBytes, type ReportPdfData } from "./report-pdf";

function reportFixture(): ReportPdfData {
  return {
    title: "Household financial report",
    dateRange: "January 1, 2026 - June 30, 2026",
    generatedAt: "August 12, 2026 at 10:00 AM",
    metadata: [
      { label: "Accounts", value: "Primary Checking, Travel Savings" },
      { label: "Categories", value: "All categories" },
    ],
    metrics: [
      { label: "Income", value: "$42,000.00" },
      { label: "Expenses", value: "$31,250.00" },
      { label: "Net cash flow", value: "$10,750.00" },
      { label: "Savings rate", value: "25.6%" },
    ],
    insights: [
      "Net cash flow improved by $2,400 compared with the prior period.",
      "Housing remained the largest expense category.",
    ],
    tables: [
      {
        title: "Expense categories",
        columns: ["Category", "Amount", "Share"],
        rows: [
          ["Housing", "$12,500.00", "40.0%"],
          ["Food", "$5,400.00", "17.3%"],
        ],
        summaryOnly: true,
      },
    ],
    chartElementIds: [],
    transactions: Array.from({ length: 72 }, (_, index) => ({
      id: `transaction-${index}`,
      date: `2026-${String((index % 6) + 1).padStart(2, "0")}-15`,
      description: `Test transaction ${index + 1}`,
      amount: 25 + index,
      type: index % 3 === 0 ? "income" : "expense",
      category: index % 3 === 0 ? "Income" : "Household",
      accountId: index % 2 === 0 ? "checking" : "savings",
    })),
    accountName: (accountId) =>
      accountId === "checking" ? "Primary Checking" : "Travel Savings",
  };
}

function pageCount(bytes: Uint8Array) {
  const content = new TextDecoder("latin1").decode(bytes);
  return content.match(/\/Type \/Page\b/g)?.length ?? 0;
}

describe("report PDF generation", () => {
  it("creates a valid summary PDF", async () => {
    const bytes = await buildReportPdfBytes(reportFixture(), "summary");

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(4_000);
    expect(pageCount(bytes)).toBeGreaterThanOrEqual(1);
  });

  it("paginates detailed transaction output", async () => {
    const fixture = reportFixture();
    const summary = await buildReportPdfBytes(fixture, "summary");
    const detailed = await buildReportPdfBytes(fixture, "detailed");

    expect(pageCount(detailed)).toBeGreaterThan(pageCount(summary));
    expect(detailed.byteLength).toBeGreaterThan(summary.byteLength);
  });
});
