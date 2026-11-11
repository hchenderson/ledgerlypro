# Ledgerly data conventions (DATA-001)

Status: implemented behind read-compatible adapters; production migration and deployment are intentionally not part of this batch.

## Audited paths

| Path | DATA-001 behavior |
|---|---|
| Manual entry and receipt review | Calendar date is written as `YYYY-MM-DD`; transaction and split cents are validated and dual-written. |
| CSV import | Decimal text is parsed exactly, date is normalized once, duplicate fingerprints use ledger day and cents. |
| Plaid sync | USD source cents/date/timestamps remain provider-owned; derived ledger fields update while user classification, splits, recurring links, and refund links are protected. |
| Transfers and account balances | Paired sides share exact cents; transfers remain balance-only; account opening/activity arithmetic uses minor-unit adapters. |
| Recurring schedules/reconciliation | Schedule and occurrence money has canonical cents; match, remainder, and variance calculations use integer arithmetic. |
| Envelopes and budgets | New budget/event values dual-write cents; summaries consume canonical cents while preserving existing envelope and nested-budget semantics. |
| Reports, Compare, Dashboard, Quarterly, EOY, forecast, CSV/PDF | Existing FIN-004 finalized-financial parity remains the source; linked refunds are signed reporting lines, and normalized ledger dates prevent browser/server day drift. New quarterly snapshots use calculation version 5 and record the effective zone. |
| Saved snapshots | Existing snapshots remain immutable and open from saved results; they are not recalculated or migrated. |

No separate Budget Portal implementation exists in this checkout, so there was no additional portal summary path to modify.

## Currency and rounding

Ledgerly currently supports **USD only**. `amountMinor` (integer cents) is authoritative when present. `amount` remains a derived major-unit compatibility field during rollout. New manual, CSV, receipt, transfer, budget, and Plaid writes populate both fields; edits rewrite both so they cannot drift. Existing records without cents remain readable through `moneyMinor()`, which rounds the legacy value once to the nearest cent. The dry run flags any value that loses fractional-cent precision or conflicts with an existing `amountMinor`.

Splits must add to the source transaction exactly in cents. Transfer sides use the same number of cents. Financial totals and account deltas consume the minor-unit adapter. Prorating and forecast averages may produce non-cent intermediate ratios; `roundRatioMinor()` defines the cent rounding point, and callers must assign any remainder deterministically so displayed components add back to the displayed total.

Currency conversion and multi-currency ledgers are outside DATA-001. A Plaid transaction with a non-USD or unofficial currency is rejected for review rather than silently treated as USD.

## Dates and reporting time zone

`ledgerDate` is the transaction's `YYYY-MM-DD` accounting date. Provider dates and timestamps are preserved separately as `sourceTransactionDate`, `sourcePostedAt`, and `sourceAuthorizedAt`. A date-only value never moves when the browser or server time zone changes.

The owner setting `users/{uid}/settings/main.reportingTimeZone` controls conversion of legacy instants and the meaning of today. Until selected, Ledgerly uses `America/New_York`. New quarterly snapshots record the effective zone. Old snapshots keep their saved results and calculation version and are never regenerated in place.

Ambiguous legacy timestamps without `Z` or an offset are not guessed by migration; the dry run marks them for review. Offset timestamps are converted in the owner's reporting zone. New manual and CSV records store a date-only value at entry.

## Refunds

A confirmed refund is a finalized account credit linked by `refundOfTransactionId` to a finalized expense.

- Account balance: the credit applies on its own ledger date.
- Reports and budgets: the refund is negative expense in the original category on the refund date; it is not income.
- Purchase history: the original charge remains unchanged, preserving gross spending and traceability.
- Partial/multiple refunds: allowed only up to the original remaining refundable cents.
- Split purchase: the user must explicitly allocate the refund; allocations must reconcile exactly.
- Uncertain credit: remains ordinary uncategorized/reviewable income until a user confirms a link.
- Removed credit: finalized-financial rules exclude it. A removed/changed original or changed linked credit sets the refund to `exception` and returns a still-finalized credit to ordinary-income review; Ledgerly never silently preserves or relinks the refund treatment.

`POST /api/refunds/link` validates ownership through Firebase Auth and links atomically with an audit event. `DELETE /api/refunds/link` unlinks atomically and returns the credit to review. There is no automatic provider-based refund match in this batch.

## Field ownership

Plaid owns provider identity, source amount/currency/date/timestamps, posting/removal state, provider description/merchant/category metadata, and sync timestamps. Users own category, category ID, envelope, splits, display description once locked, recurring reconciliation, and refund links. Derived fields (`amountMinor`/`amount`, `ledgerDate`/`date`, and possible-transfer state) are recomputed from the owning source. Plaid resync preserves user-controlled classification, splits, recurring links, and refund links.

If the provider changes source amount/date/status, derived values update and a manually controlled record moves to review. A removed linked refund no longer affects financial totals. A removed original remains an exception requiring review; automatic reassignment is prohibited.

## Dry-run migration and rollout

Run against an exported, access-controlled JSON file; the command prints aggregate counts only:

```bash
npm run migration:data001:dry-run -- /path/to/export.json America/New_York
```

The input can be a transaction array or an object containing `transactions`, `accounts`, `budgets`, and `recurringTransactions`. The analyzer reports clean records, already-canonical records, review records, proposed amount/date conversions, period changes, balance changes, collection-level money readiness, and reason counts. It never writes Firestore. `migrationBatches()` orders clean transaction records by ID, excludes completed checkpoint IDs, caps batches at 400, and therefore produces the same remaining work after interruption. Account, budget, and recurring writes remain a separately reviewed migration step after their collection summaries are clean.

Recommended separately reviewed rollout:

1. Back up Firestore and export a read-only migration input.
2. Run the dry report using each ledger owner's effective zone; resolve every precision, currency, date, split, and field-conflict review.
3. Compare pre/post golden totals, per-account balances, period totals, and saved snapshot access in an emulator or isolated project.
4. Deploy dual-write code while reads continue through the compatibility adapter.
5. Migrate clean records in checkpointed batches; rerun the dry report after every batch.
6. Verify zero unexplained balance/period changes, then switch operational monitoring to require canonical fields on new writes.
7. Retain legacy fields through at least one backup/restore cycle.

Rollback restores the pre-migration backup or removes newly added canonical fields from the affected checkpointed batch. Since saved snapshot results are immutable and legacy reads remain supported, rollback does not require recalculating historical reports.

## Release prerequisites and open items

- Firestore emulator tests now cover refund atomicity/rules, FIN-003 reconciliation, protected fields, and mixed legacy/canonical writes.
- Authenticated isolated browser checks now cover manual entry/edit, receipt save with a stubbed extractor, CSV import, reports/exports, quarterly generation, and time-zone setting. Refund linking is verified through its normal server API; live Plaid pending-to-posted/removal remains a production-pilot check.
- Collection-specific Firestore rules protect canonical fields and server-owned links in the repository; staged production publication remains pending (SEC-002).
- Produce a real aggregate-only production dry-run report and review all exceptions. No production dry run or migration was executed in DATA-001.
