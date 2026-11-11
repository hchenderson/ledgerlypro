import type { Transaction } from '@/types';
import { transactionLedgerDate } from '@/lib/ledger-date';
import { moneyMinor } from '@/lib/money';

export type TransactionImportSummary = {
  imported: number;
  duplicates: number;
};

export function transactionFingerprint(
  transaction: Pick<
    Transaction,
    'date' | 'ledgerDate' | 'description' | 'amount' | 'amountMinor' | 'currency' | 'type' | 'accountId'
  >
): string {
  let dateKey: string;
  try {
    dateKey = transactionLedgerDate(transaction);
  } catch {
    dateKey = transaction.date.trim();
  }
  const description = transaction.description.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const amountInCents = moneyMinor(transaction);
  return [
    transaction.accountId ?? 'primary-account',
    dateKey,
    description,
    amountInCents,
    transaction.type,
  ].join('|');
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
