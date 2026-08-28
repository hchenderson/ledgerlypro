import type { Transaction } from "@/types";

export function canEditTransaction(
  transaction: Pick<Transaction, "type">,
): boolean {
  return transaction.type !== "transfer";
}

export function historicalTransactionYear(
  transaction: Pick<Transaction, "date">,
  systemYear = new Date().getFullYear(),
): number | undefined {
  const year = new Date(transaction.date).getFullYear();
  return Number.isFinite(year) && year < systemYear ? year : undefined;
}
