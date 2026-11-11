import type { Transaction } from "@/types";
import { transactionLedgerDate } from "@/lib/ledger-date";

export function canEditTransaction(
  transaction: Pick<Transaction, "type">,
): boolean {
  return transaction.type !== "transfer";
}

export function historicalTransactionYear(
  transaction: Pick<Transaction, "date">,
  systemYear = new Date().getFullYear(),
): number | undefined {
  const year = Number(transactionLedgerDate(transaction).slice(0, 4));
  return Number.isFinite(year) && year < systemYear ? year : undefined;
}
