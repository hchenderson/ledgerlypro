import { financialTransactionAmount, transactionAmount } from "@/lib/financial-summary";
import { transactionLedgerDate } from "@/lib/ledger-date";
import { sourceTransactionId } from "@/lib/transaction-allocations";
import type { Transaction } from "@/types";

export interface ReportCsvRow {
  Date: string;
  Description: string;
  Account: string;
  Category: string;
  CategoryId: string;
  Type: string;
  Direction: string;
  Status: string;
  Amount: number;
  GrossAmount: number;
  FinancialTreatment: "income" | "expense" | "refund" | "refund-exception" | "transfer";
  SourceTransactionId: string;
}

/** Build CSV rows from the exact already-filtered report transaction set. */
export function buildReportCsvRows(
  transactions: Transaction[],
  accountName: (accountId?: string) => string,
): ReportCsvRow[] {
  return transactions.map((transaction) => ({
    Date: transaction.date ? transactionLedgerDate(transaction) : "",
    Description: transaction.description || "",
    Account: accountName(transaction.accountId),
    Category: transaction.category || "",
    CategoryId: transaction.categoryId || "",
    Type: transaction.type || "",
    Direction:
      transaction.type === "transfer"
        ? transaction.transferDirection ?? ""
        : "",
    Status: transaction.postingStatus ?? "posted",
    Amount: financialTransactionAmount(transaction),
    GrossAmount: transactionAmount(transaction),
    FinancialTreatment: transaction.refundOfTransactionId
      ? transaction.refundStatus === "confirmed" ? "refund" : "refund-exception"
      : transaction.type,
    SourceTransactionId: sourceTransactionId(transaction),
  }));
}

export function summarizeReportCsvRows(rows: ReportCsvRow[]) {
  const income = rows
    .filter((row) => row.Type === "income")
    .reduce((sum, row) => sum + row.Amount, 0);
  const expenses = rows
    .filter((row) => row.Type === "expense")
    .reduce((sum, row) => sum + row.Amount, 0);
  return { income, expenses, net: income - expenses };
}
