import { readFile } from "node:fs/promises";

import { analyzeData001Dataset } from "../src/lib/data001-migration";
import { DEFAULT_REPORTING_TIME_ZONE } from "../src/lib/ledger-date";
import type { Account, Budget, RecurringTransaction, Transaction } from "../src/types";

async function main() {
  const file = process.argv[2];
  const timeZone = process.argv[3] ?? DEFAULT_REPORTING_TIME_ZONE;
  if (!file) throw new Error("Usage: npm run migration:data001:dry-run -- <export.json> [IANA-time-zone]");
  const parsed = JSON.parse(await readFile(file, "utf8")) as Transaction[] | {
    transactions: Transaction[];
    accounts?: Account[];
    budgets?: Budget[];
    recurringTransactions?: RecurringTransaction[];
  };
  const dataset = Array.isArray(parsed) ? { transactions: parsed } : parsed;
  const result = analyzeData001Dataset(dataset, timeZone);
  const report = result.transactions;
  // Aggregate output only: descriptions, amounts, and account data are never printed.
  console.log(JSON.stringify({
    reportingTimeZone: timeZone,
    total: report.total,
    clean: report.clean,
    alreadyCanonical: report.alreadyCanonical,
    needsReview: report.needsReview,
    amountConversions: report.amountConversions,
    ledgerDateConversions: report.ledgerDateConversions,
    periodChanges: report.periodChanges,
    balanceChanges: report.balanceChanges,
    reviewReasons: report.records.flatMap((record) => record.reasons).reduce<Record<string, number>>((counts, reason) => ({ ...counts, [reason]: (counts[reason] ?? 0) + 1 }), {}),
    collections: result.collections,
  }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "DATA-001 dry run failed.");
  process.exitCode = 1;
});
