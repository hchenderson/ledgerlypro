import { transactionBalanceDelta } from "@/lib/accounts";
import { isAmbiguousLegacyDate, transactionLedgerDate } from "@/lib/ledger-date";
import { canonicalMoneyFields, legacyMajorToMinor } from "@/lib/money";
import { canonicalizeTransactionMoney } from "@/lib/transaction-allocations";
import type { Account, Budget, RecurringTransaction, Transaction } from "@/types";

export type Data001ReviewReason =
  | "ambiguous-date"
  | "canonical-legacy-conflict"
  | "fractional-cent-rounded"
  | "split-does-not-reconcile"
  | "unsupported-currency"
  | "invalid-date";

export interface Data001MigrationRecord {
  id: string;
  status: "clean" | "review" | "already-canonical";
  reasons: Data001ReviewReason[];
  periodChanged: boolean;
  balanceDeltaChanged: boolean;
  proposed?: Transaction;
}

export interface Data001MigrationReport {
  total: number;
  clean: number;
  alreadyCanonical: number;
  needsReview: number;
  amountConversions: number;
  ledgerDateConversions: number;
  periodChanges: number;
  balanceChanges: number;
  records: Data001MigrationRecord[];
}

export interface Data001Dataset {
  transactions: Transaction[];
  accounts?: Account[];
  budgets?: Budget[];
  recurringTransactions?: RecurringTransaction[];
}

export interface Data001CollectionSummary {
  total: number;
  clean: number;
  alreadyCanonical: number;
  needsReview: number;
}

function legacyDatePrefix(transaction: Transaction) {
  return /^\d{4}-\d{2}-\d{2}/.test(transaction.date) ? transaction.date.slice(0, 10) : "";
}

export function analyzeData001Migration(
  transactions: Transaction[],
  reportingTimeZone: string,
): Data001MigrationReport {
  const records = transactions.map((transaction): Data001MigrationRecord => {
    const reasons: Data001ReviewReason[] = [];
    if (transaction.currency && transaction.currency !== "USD") reasons.push("unsupported-currency");
    if (isAmbiguousLegacyDate(transaction.date)) reasons.push("ambiguous-date");
    const legacyMinor = legacyMajorToMinor(transaction.amount);
    if (Math.abs(transaction.amount * 100 - legacyMinor) > 0.000001) reasons.push("fractional-cent-rounded");
    if (transaction.amountMinor !== undefined && transaction.amountMinor !== legacyMinor) reasons.push("canonical-legacy-conflict");

    let ledgerDate = "";
    try {
      ledgerDate = transactionLedgerDate(transaction, reportingTimeZone);
    } catch {
      reasons.push("invalid-date");
    }
    let proposed: Transaction | undefined;
    if (!reasons.includes("unsupported-currency") && ledgerDate) {
      try {
        proposed = canonicalizeTransactionMoney({
          ...transaction,
          ...canonicalMoneyFields(transaction),
          ledgerDate,
        });
      } catch {
        reasons.push("split-does-not-reconcile");
      }
    }
    const periodChanged = Boolean(ledgerDate && legacyDatePrefix(transaction) && ledgerDate !== legacyDatePrefix(transaction));
    const before = transactionBalanceDelta({ ...transaction, amountMinor: undefined, currency: undefined });
    const after = proposed ? transactionBalanceDelta(proposed) : before;
    const alreadyCanonical = Boolean(
      transaction.amountMinor !== undefined &&
      transaction.currency === "USD" &&
      transaction.ledgerDate &&
      reasons.length === 0,
    );
    return {
      id: transaction.id,
      status: reasons.length ? "review" : alreadyCanonical ? "already-canonical" : "clean",
      reasons: [...new Set(reasons)],
      periodChanged,
      balanceDeltaChanged: Math.round(before * 100) !== Math.round(after * 100),
      ...(proposed ? { proposed } : {}),
    };
  });
  return {
    total: records.length,
    clean: records.filter((record) => record.status === "clean").length,
    alreadyCanonical: records.filter((record) => record.status === "already-canonical").length,
    needsReview: records.filter((record) => record.status === "review").length,
    amountConversions: records.filter((record) => record.proposed && transactions.find((item) => item.id === record.id)?.amountMinor === undefined).length,
    ledgerDateConversions: records.filter((record) => record.proposed && !transactions.find((item) => item.id === record.id)?.ledgerDate).length,
    periodChanges: records.filter((record) => record.periodChanged).length,
    balanceChanges: records.filter((record) => record.balanceDeltaChanged).length,
    records,
  };
}

/** Deterministic checkpoints make a later migration safe to retry after interruption. */
export function migrationBatches(
  report: Data001MigrationReport,
  completedIds: Set<string>,
  batchSize = 200,
): Transaction[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 400) throw new Error("Migration batch size must be 1–400.");
  const eligible = report.records
    .filter((record) => record.status === "clean" && record.proposed && !completedIds.has(record.id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((record) => record.proposed!);
  return Array.from({ length: Math.ceil(eligible.length / batchSize) }, (_, index) => eligible.slice(index * batchSize, (index + 1) * batchSize));
}

function moneyCollectionSummary<T extends { amount: number; amountMinor?: number; currency?: string }>(records: T[]): Data001CollectionSummary {
  let alreadyCanonical = 0;
  let needsReview = 0;
  for (const record of records) {
    const legacyMinor = legacyMajorToMinor(record.amount);
    const conflict = record.currency && record.currency !== "USD" ||
      record.amountMinor !== undefined && record.amountMinor !== legacyMinor ||
      Math.abs(record.amount * 100 - legacyMinor) > 0.000001;
    if (conflict) needsReview += 1;
    else if (record.amountMinor !== undefined && record.currency === "USD") alreadyCanonical += 1;
  }
  return {
    total: records.length,
    clean: records.length - alreadyCanonical - needsReview,
    alreadyCanonical,
    needsReview,
  };
}

export function analyzeData001Dataset(dataset: Data001Dataset, reportingTimeZone: string) {
  const transactions = analyzeData001Migration(dataset.transactions, reportingTimeZone);
  const accounts = moneyCollectionSummary(
    (dataset.accounts ?? []).map((account) => ({
      amount: account.openingBalance,
      amountMinor: account.openingBalanceMinor,
      currency: account.currency,
    })),
  );
  const budgets = moneyCollectionSummary(dataset.budgets ?? []);
  const recurringTransactions = moneyCollectionSummary(dataset.recurringTransactions ?? []);
  return { transactions, collections: { accounts, budgets, recurringTransactions } };
}
