import type { Transaction } from '@/types';

export type TransactionImportSummary = {
  imported: number;
  duplicates: number;
};

export function transactionFingerprint(
  transaction: Pick<Transaction, 'date' | 'description' | 'amount' | 'type'>
): string {
  const date = new Date(transaction.date);
  const dateKey = Number.isNaN(date.getTime())
    ? transaction.date.trim()
    : date.toISOString().slice(0, 10);
  const description = transaction.description.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const amountInCents = Math.round(Math.abs(transaction.amount) * 100);
  return [dateKey, description, amountInCents, transaction.type].join('|');
}

export function prepareTransactionImport(
  transactions: Omit<Transaction, 'id'>[],
  existingTransactions: Transaction[]
): { transactions: Omit<Transaction, 'id'>[]; duplicates: number } {
  const fingerprints = new Set(existingTransactions.map(transactionFingerprint));
  const unique: Omit<Transaction, 'id'>[] = [];
  let duplicates = 0;

  for (const transaction of transactions) {
    const fingerprint = transactionFingerprint(transaction);
    if (fingerprints.has(fingerprint)) {
      duplicates += 1;
      continue;
    }
    fingerprints.add(fingerprint);
    unique.push(transaction);
  }

  return { transactions: unique, duplicates };
}
