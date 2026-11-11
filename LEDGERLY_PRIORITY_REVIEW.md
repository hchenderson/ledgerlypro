# Ledgerly Priority Review

**Assessment date:** November 2, 2026
**Repository state reviewed:** `main` at `4b34887` (`Support nested category report filters`)
**Scope:** Read-only product, architecture, financial-calculation, security, reliability, usability, performance, and integration assessment. No application code or production data was changed.

## Executive assessment

Ledgerly is already a substantial private financial workspace, not a prototype. Its strongest capabilities are its multi-account ledger, atomic paired transfers, nested categories, split allocations, envelope budgeting, designated-fund reporting, customizable Reports and Compare views, PDF/CSV exports, deterministic Plaid IDs, and a careful Plaid sync implementation. The main Reports path is notably better structured than many applications at this stage: one filtered transaction set feeds its cards, charts, category tables, and exports.

The product is **not yet dependable enough to treat every displayed number as authoritative**. The most important reason is not Firestore or Firebase itself; it is that several financial views use independent calculation paths. The budget hook can include pending or removed Plaid transactions, the forward forecast can multiply its global fallback baseline by the number of categories, recurring schedules can coexist with the actual Plaid-posted transaction, and quarterly/EOY reports do not fully share the main report kernel. Those are fixable, but they should be addressed before expanding integrations.

There is also one P0 dependency issue: the installed Next.js version is covered by current critical advisories and has a compatible patch available. The repository otherwise has a sound security boundary for single-user data and protects Plaid secrets from clients, but its Firestore rules allow any authenticated owner to write almost any shape into most of their collections, App Check is disabled, and backup/restore settings cannot be verified from source control.

Overall judgment: **strong feature breadth, good recent financial-domain design, uneven calculation convergence, and production-hardening work still required.** The best next investment is a small, explicit “financial kernel” contract backed by a golden ledger test suite. New integrations should consume that contract rather than create more calculation paths.

## Implementation status

Status as of the focused first-priority batch on branch `codex/priority-batch-sec-test-fin`:

| ID | Status | Exact completed scope |
|---|---|---|
| **SEC-001** | **Complete for the reported Next/Image Optimization exposure and current 15.5.x patch line** | Verified GHSA-2464-fhr4-w9xw against the installed stack and upgraded Next.js 15.5.20 → 15.5.29, Sharp 0.34.5 → 0.35.5, and `eslint-config-next` → 15.5.29. Version 15.5.29 supersedes the earlier 15.5.28 result with the November 2026 official fixes. The related Next critical finding is cleared. Broader Firebase, Genkit, Zod, PostCSS, and transitive advisories remain tracked follow-up work. |
| **TEST-001** | **Complete for the expanded calculation contract** | Added a hand-calculated synthetic ledger covering canonical inclusion, dates, splits, linked transfers, two accounts, account filters, nested/overlapping budgets, balances, designated/operating activity, deterministic forecasts, and recurring-to-actual reconciliation. This is calculation-level coverage, not browser/page integration coverage. Refund-category behavior remains one explicit TODO domain test. |
| **FIN-001** | **Complete** | Budget cards now use the shared finalized-financial reporting helper, excluding pending, removed, possible-transfer, and transfer records while expanding split allocations once. Account scope remains caller-defined and is verified against the Reports calculation path. Parent/child card overlap remains intentional and is now documented. |
| **FIN-002** | **Complete for the deterministic forward-forecast scope** | The Dashboard forecast now uses one pure 90-calendar-day kernel with explicit local-calendar boundaries, canonical finalized-financial history, split expansion once, selected-account history/schedules/opening balances, and separate income, expense, net, and ending-balance totals. Merchant, category, and single residual estimates partition history without reuse; unused categories no longer multiply the global baseline. Dashboard detail and the AI narrative consume the corrected deterministic result. FIN-003 now supplies explicit fulfilled/partial/skipped/exception occurrence state and excludes confirmed recurring actuals from duplicate historical estimates. |
| **FIN-003** | **Complete for explicit recurring-to-actual reconciliation** | Recurring schedules now create server-managed forecast expectations instead of ledger transactions. Stable occurrences retain original due-date/expected snapshots; deterministic candidates require user confirmation; confirm, dismiss, skip, undo-link, provider invalidation, and retry behavior are atomic and audited. Finalized actuals remain authoritative for balances, budgets, Reports, and envelopes, while fulfilled/skipped occurrences contribute zero to the forecast and partial payments leave only the remainder. Explicit legacy recurring records and generated envelope events have a compatibility path; description-only records are reported but never auto-reclassified. Cross-source duplicate detection and refund semantics remain separate work. |
| **FIN-004** | **Complete for deterministic financial totals, generated snapshots, and export source parity** | Reports, Compare, Dashboard cash-flow metrics, Quarterly, EOY, and CSV use the same finalized-financial, split-allocation, and stable-category rules for equivalent scope. Quarterly aggregate actuals use most-specific budget assignment while preserving parent subtree drill-down values. Version-4 quarterly snapshots are immutable revisions with effective filters and saved results; old snapshots remain untouched. Historical goal progress is marked unavailable without dated evidence. PDF builders consume the same calculated data shown on screen. |
| **DATA-001** | **Complete for compatibility code, deterministic calculations, and non-writing migration preparation** | USD cents are authoritative when present; legacy values remain readable. New transaction/import/Plaid/transfer/budget writes dual-write cents and ledger dates, owner reporting time zone is persisted, Plaid source facts are separated from user classification, and confirmed refunds reconcile as account credits plus negative expense. A deterministic aggregate-only dry run and checkpoint planner are implemented. No production migration or deployment was performed. |
| **SEC-002** | **Complete for repository rules, isolated emulator/browser coverage, and staged App Check preparation; rollout pending** | The broad owner wildcard is replaced by collection contracts and deny-by-default fallback. Provider, posting, recurring/refund-link, audit, snapshot, and operational fields are server-owned. Categorization-rule/audit, clear-data, and financial-summary cache mutations now use authenticated Admin routes. Sixteen two-user/routing tests pass; authenticated Chromium passes with both captured baseline and proposed rules. The previous-client partial-clear incompatibility is explicit. Custom-route App Check has off/monitor/enforce modes and documented rollout/rollback. No production rules, console settings, enforcement, or deployment changed. |

Release-preparation validation: the isolated Firestore suite passes 16 tests covering rules, old-client compatibility, FIN-003/DATA-001, and financial-summary Admin paths; the unit suite passes 36 files/172 tests; typecheck passes; lint passes with the pre-existing custom-font warning; and the Next.js 15.5.29 production build passes with synthetic Firebase values. Authenticated Chromium passes with proposed rules and with the captured baseline rules. Production baseline equivalence, App Check registration/telemetry, production DATA-001 dry run, rules publication, enforcement, and deployment remain outstanding; no production data or settings were changed. See `docs/RELEASE_CANDIDATE_CHECKLIST.md`.

## 1. Current state and verified architecture

### Technology and deployment

| Area | Current implementation | Assessment |
|---|---|---|
| Web application | Next.js App Router 15.5.20, React 18.3.1, TypeScript; Firebase App Hosting configuration | Verified in `package.json:5-70` and `apphosting.yaml:1-42`. |
| Primary database | Cloud Firestore | Verified. Client data is stored below `users/{uid}`. No Realtime Database use was found. |
| Authentication | Firebase Authentication: email/password and Google; email verification is required for password accounts | Working implementation. Apple sign-in appears only in the old blueprint and is not implemented. |
| Server/API layer | Next.js route handlers using Firebase Admin; no separately defined Cloud Functions or custom Cloud Run service was found | Authenticated APIs cover AI, Plaid, categorization, recurring materialization, quarterly reports, and account deletion. |
| AI | Genkit with Google Gemini for receipt extraction, projections, chat, and narrative summaries | Implemented behind authenticated server routes. Results should remain advisory. |
| Bank integration | Plaid Link, account mapping, incremental transaction sync, webhooks, job processing, cached balances, optional real-time balances | Implemented, but deployment configuration remains `sandbox` (`apphosting.yaml:29-36`). |
| File storage | Firebase Storage bucket configuration exists, but no Storage SDK upload/read path or storage rules were found | Receipt scanning extracts data from a client-provided image but does not provide a durable receipt repository. |
| CI | GitHub Actions on Node 20.20.2 runs `npm ci`, lint, typecheck, unit tests, and build | Verified in `.github/workflows/ci.yml:11-31`. No end-to-end or Firebase emulator/rules test job exists. |

### Authentication, organizations, roles, and permissions

- The effective tenancy boundary is the Firebase user UID. Firestore rules require `request.auth.uid == userId` for reads and most writes under `users/{uid}` (`firestore.rules:5-16`).
- Sensitive Plaid token, owner-lookup, webhook, operation, and rate-limit collections are explicitly denied to clients (`firestore.rules:18-33`). Server Admin code bypasses rules and authenticates API callers with Firebase ID tokens.
- Account `role` values such as operating, envelope, debt, and standard describe **financial use**, not user authorization.
- There is no organization/workspace entity, membership collection, bookkeeper role, approver role, or shared access. Ledgerly is currently a single-user-per-ledger product.
- Account deletion is server-side and recursively deletes the user's Firestore subtree and related Plaid server records. This is a good foundation, but deletion and backup recovery need production drills.

### Data model and financial conventions

The principal user collections include transactions, accounts, categories, budgets, goals, recurring transactions, envelopes and envelope events, designated funds, report views, report snapshots, categorization rules, Plaid-safe metadata, balance snapshots, and settings. The important design conventions are:

- Transaction amounts are positive JavaScript `number` values; direction comes from `type` (`income`, `expense`, or `transfer`).
- Transfers are linked in/out transaction pairs and are excluded from income, expense, budget, and cash-flow metrics. Balance deltas are centralized in `src/lib/accounts.ts:50-110`.
- Split allocations keep the original bank transaction once in the account ledger and expand it into reporting lines for category and budget calculations (`README.md:147-153`).
- Pending, removed, and possible-transfer Plaid transactions are supposed to be excluded from financial metrics (`README.md:183-188`). The core report path does this correctly (`src/lib/report-analytics.ts:220-271`), but not every feature follows that rule.
- Money is not stored in integer minor units. Allocation validation converts to cents, but core transaction, balance, report, and budget totals use floating-point numbers.
- Dates are stored as ISO strings, but some paths interpret them in local time and at least one assistant path uses UTC-year/month logic. There is no explicit per-ledger reporting time zone.

### Feature and workflow map

| Capability | Status | Evidence-based notes |
|---|---|---|
| Sign-up, sign-in, verification, password reset, Google auth | Implemented | Email verification and Google sign-in are present. The old `docs/blueprint.md:5` claim of Apple auth is outdated. |
| Organizations and shared roles | Not implemented | UID ownership is the only tenant/permission model. |
| Transactions and categories | Implemented | Manual add/edit/delete, nested categories, split allocations, multi-account filtering, search, and historical editing are present. |
| CSV import | Implemented with limits | Preview, 5 MB cap, exact fingerprint dedupe, and chunked writes exist. Cross-source CSV/Plaid duplicate matching does not. |
| Accounts, transfers, reconciliation | Implemented | Transfer pairs use atomic batches; account balance-as-of views and statement reconciliation records are present. |
| Budgets | Implemented with a confirmed calculation defect | Nested-category budgets and prorating exist. Pending/removed/possible-transfer filtering is inconsistent with Reports. |
| Envelopes | Implemented | Opt-in tracking/envelope/hybrid modes, immutable events, account-backed envelopes, funding/release/return, and rollover guidance are present. Ledgerly does not move bank money. |
| Designated/restricted funds | Implemented | Separate received/spent/opening/ending reconciliation and operating summary exist; finalized transaction filtering is used (`src/lib/designated-funds.ts:29-83`). |
| Goals | Implemented | Manual and automatic tracking exist. Historical quarterly snapshots use current goal state rather than quarter-end state. |
| Recurring commitments | Implemented with reviewable actual reconciliation | Stable expectation records are forecast-only. Posted candidates are suggested from account, direction, date, amount, and merchant evidence but require confirmation; linked actuals are authoritative and provider removals return the expectation as an exception. |
| Dashboard analytics and balances | Implemented | Current balance, income/expense, budget summaries, trajectories, favorite budgets, and configurable cards exist. Balance intentionally remains ledger-wide when category filters apply. |
| “Next 90 Days Net” / projections | Implemented; deterministic and recurring overlap scope corrected | One kernel supplies the Dashboard and AI narrative with canonical history, account-scoped balances and schedules, and partitioned merchant/category/residual estimates. Fulfilled/skipped recurring occurrences are removed, partials project only the remainder, and confirmed recurring actuals do not seed a duplicate historical estimate. |
| Receipt scanning | Partially implemented | AI extraction and transaction prefill work. The final write is not awaited, and the source receipt is not durably stored or attached. |
| Reports and Compare | Implemented, strongest analytics area | Exact date/account/status/category filters, nested category keys, saved views, comparison, balance-as-of, charts, transaction detail, CSV/PDF export. |
| Quarterly generated reports | Implemented with reconciliation gaps | Stored snapshots exist, but budget aggregation and goal history differ from main Reports. |
| Year-end reports | Implemented with category-detail gaps | Totals use finalized transactions, but category-name matching can omit renamed/unknown detail and collapse duplicate names. |
| Plaid | Substantial sandbox implementation | Incremental cursor sync, mutation restart, deterministic IDs, pending-to-posted inheritance, removed-item handling, encrypted access tokens, webhook verification, jobs, leases, and retention. Production access is not configured in the checked-in deployment file. |
| Ramp, giving, payroll, accounting, Drive/Nextcloud | Not implemented | These are roadmap candidates only. Stripe packages are installed but no active billing workflow was found. |

### Documentation accuracy

`README.md` is the best repository-level description and is broadly consistent with the current code, including the current Plaid and production-readiness checklist. `docs/blueprint.md` is an early concept document: Apple sign-in and receipt attachment are not current capabilities, and its feature list omits most of the present product. `bluprint.md` is primarily a visual style reference. Future work should treat README and executable tests as authoritative and label the blueprint as historical or replace it with a generated capability matrix.

## 2. Top 10 changes in recommended execution order

| Order | ID | Priority | Recommendation | Why this order |
|---:|---|---|---|---|
| 1 | **SEC-001** | P0 | Patch Next.js and perform targeted dependency remediation | It closes a verified critical exposure with a patch-version update before feature work. |
| 2 | **TEST-001** | P1 | Create a golden financial ledger and cross-view reconciliation suite | It defines expected numbers before changing multiple calculation paths and prevents recurrence. |
| 3 | **FIN-001** | P1 | Make budget actuals use the canonical finalized-financial filter | This is a small, confirmed correction to user-visible money. |
| 4 | **FIN-002** | P1 | Correct and simplify the 90-day forecast baseline and account scope | The current algorithm can materially overstate future cash flow, a high-impact decision metric. |
| 5 | **FIN-003** | P1 | Reconcile scheduled recurring occurrences with imported actuals | This prevents ordinary connected-bank use from double-counting bills or income. |
| 6 | **FIN-004** | P1 | Converge Quarterly, EOY, Compare, Dashboard, and Reports on one calculation contract | This eliminates independent definitions of the same metric and fixes historical/report drift. |
| 7 | **DATA-001** | P1 | Adopt canonical money, date, time-zone, refund, and source-of-truth conventions | These invariants are prerequisites for trustworthy integrations and long-term accuracy. |
| 8 | **SEC-002** | P1 | Roll out the completed collection rules and staged App Check implementation | Repository implementation and isolated tests are complete; compatible app-first deployment, browser smoke checks, telemetry, and service enforcement remain. |
| 9 | **REL-001** | P1 | Make receipt/import writes observable and recoverable | A failed receipt save can currently appear successful; imports need an explicit run/recovery record. |
| 10 | **OPS-001** | P1 | Verify backups, add alerts/runbooks, and revisit the one-instance cap | Financial data needs tested recovery and production visibility before growth or more integrations. |

The sequence deliberately puts a characterization test ledger before broad financial refactoring. The exception is the Next.js patch because the exposure is current, low-effort, and independent. Performance and organization work follow after correctness and recovery controls because faster or shared incorrect numbers would increase harm.

## 3. A. Immediate issues

Confidence labels mean: **verified** = directly demonstrated by code/checks; **strongly indicated** = code path clearly creates the risk but no production dataset was inspected; **exploratory** = hypothesis requiring measurement.

| ID | Pri. | Finding, trigger, and likely consequence | Evidence / confidence | Recommended correction | Effort, dependencies, risk | Acceptance criteria |
|---|---|---|---|---|---|---|
| **SEC-001** | **P0** | Next.js 15.5.20 was covered by critical advisories. An externally reachable image/server path could expose the app to RCE/DoS depending on configuration and payload. | The initial production audit reported 5 critical findings. Official Next.js guidance now identifies 15.5.29 as the current security-fix release in the maintained 15.5.x line. The candidate is on 15.5.29 and the production audit reports 0 critical. **Verified.** | Keep Next and matching tooling on 15.5.29 for this release; run the full suite/build/browser smoke checks. Triage Zod/Firebase/Genkit/PostCSS advisories separately rather than forcing unsafe major upgrades. | **Implemented.** Patch-level compatibility passed. | Next is at the current fixed 15.5.x patch; the Next critical is cleared; isolated browser and production build checks pass. |
| **FIN-001** | **P1** | A pending, provider-removed, or possible-transfer Plaid expense can appear in Budget actuals even though Reports excludes it. Trigger: such a transaction matches a budget category/year. Consequence: false overspend and disagreement between pages. | `src/hooks/use-budgets.tsx:138-166` filters only year/type/category. Canonical logic requires finalized status and excludes possible transfers (`src/lib/accounts.ts:50-61`; `src/lib/report-analytics.ts:220-271`). **Verified.** | Replace local budget filtering with the shared financial predicate/reporting expansion and add pending/removed/possible-transfer/split fixtures. | **Small, 0.5–1 day.** Depends on TEST-001 fixtures. Low risk. | For one fixture ledger, budget actual equals the Reports budget actual to the cent; pending, removed, possible-transfer, and transfer entries change neither. |
| **FIN-002** | **P1** | “Next 90 Days Net” can be significantly overstated and can ignore the selected account scope. Trigger: a configured category has little/no profile. The fallback applies the full global weekly income and expense once for every included category. | All actual income/expense is admitted without finalized/transfer/account filtering (`src/hooks/use-forward-forecast.ts:37-68`). Every configured category is included (`:82-102`). Missing category profiles reuse the global baseline inside the per-category loop (`src/forecast/baseline-category-weekday.ts:191-237`). **Verified algorithmic defect.** | Filter actuals with the canonical transaction/account predicate. Use a single global residual fallback, not one fallback per missing category. Ensure merchant and category models partition history without overlap; surface “data sufficiency” and backtest error. | **Medium, 3–5 days.** Requires TEST-001 and forecast fixtures. Moderate model-regression risk. | Adding empty categories does not change a forecast; selected-account forecast contains only that account; pending/transfers do not affect it; rolling backtests meet an agreed error threshold and the UI labels uncertainty. |
| **FIN-003** | **P1 — completed for verified scope** | The prior processor wrote schedule materializations into the transaction ledger while Plaid created separate provider records, allowing the same real-world payment to appear twice. | Reproduced in the synthetic ledger, then replaced with `recurringOccurrences`, explicit transaction provenance, a server reconciliation API, and forecast integration. Calculation tests now prove a $100 expectation plus confirmed $103 actual yields one $103 expense in balances, budgets, and Reports and zero for that fulfilled forecast occurrence. **Verified fixed for explicit links.** | Keep the current user-confirmed workflow. Add emulator/API integration and authenticated browser coverage when the repository gains an isolated Firebase test environment. Cross-source duplicate detection remains outside FIN-003. | **Implemented.** Remaining risk is integration coverage rather than the deterministic calculation contract. | Fulfilled, partial, skipped, invalidated, unlinked, legacy, account-scope, date-window, and retry/competition cases pass focused tests; no production migration was executed. |
| **FIN-004** | **P1 — completed for verified scope** | Quarterly actuals previously counted a child expense in both parent and child rows; historical reports copied current goal values; EOY category detail keyed by display name and silently omitted unknown names. | Reproductions live in `src/lib/quarterly-report.test.ts`, `src/lib/eoy.test.ts`, and `src/lib/financial-surface-parity.test.ts`. The shared stable-ID breakdown is in `src/lib/financial-category-breakdown.ts`; equivalent scoped surfaces reconcile through the Reports finalized-financial contract. **Verified fixed at calculation/API-adapter level.** | Preserve calculation version 4 and immutable snapshot revisions. Add authenticated browser/export smoke coverage and an emulator-backed snapshot-generation test in an isolated Firebase environment. | **Implemented.** Old snapshots are preserved read-only; no migration was performed. Remaining risk is browser/emulator integration coverage, not the deterministic calculation result. | Equivalent synthetic scope reconciles Reports, Compare, Dashboard, Quarterly, EOY, and CSV to the cent; EOY detail sums to total; parent/child quarterly aggregate counts the child once; unavailable historical goal progress is explicit. |
| **DATA-001** | **P1 — completed for verified compatibility scope; rollout pending** | Floating-point money, mixed local/UTC year logic, and generic refund income created cumulative, boundary, and category/budget risk. | `src/lib/money.ts`, `src/lib/ledger-date.ts`, `src/lib/refunds.ts`, and `src/lib/data001-migration.ts` now define the contract. The golden refund example proves a $40 later-period credit raises the account balance while producing $0 income and −$40 expense in the original category. Migration tests cover precision/date/split conflicts and retry checkpoints. **Verified at deterministic calculation level.** | Run the documented aggregate-only dry run on an access-controlled export, resolve all review records, add emulator/rules and authenticated browser coverage, then separately review backup, checkpointed migration, dual-read verification, and rollback. | **Implementation complete; production rollout remains large/high risk.** No production records were inspected or converted. | Compatibility reads preserve old records; canonical cents win when present; exact split/transfer invariants pass; owner-zone boundary fixtures pass; Reports/Budgets/CSV and balances reconcile for linked refunds; dry run is read-only and rerunnable. |
| **SEC-002** | **P1 — repository work complete; rollout pending** | The former wildcard allowed structurally invalid own-ledger writes and direct mutation of protected provenance/link fields. App Check had only a boolean enforcement switch and no custom-route monitor mode. | `firestore.rules` now has explicit collection matches and no broad grant. Sixteen emulator tests prove owner queries/listeners, cross-user denial, legacy/canonical edits, protected fields, transfer batches, server-only collections, server reconciliation/refunds, and old-client incompatibility. Authenticated Chromium passes with captured baseline and proposed rules. **Verified fixed in the repository.** | Deploy the app before stricter rules; require old tabs to refresh; then publish rules separately. Register reCAPTCHA Enterprise, observe verified traffic in monitor mode, and enforce custom routes, Firestore, and Authentication separately. See `docs/SECURITY_FIRESTORE_APPCHECK.md`. | **Implementation complete; staged rollout remains medium risk.** Older deployed clients can break or partially clear data if rules are enabled out of order. | Repository acceptance is met. Production acceptance remains open until the deployed rules baseline is verified and production App Check metrics show legitimate traffic before enforcement. |
| **REL-001** | **P1** | Receipt-created transactions can fail after the scanner resets and closes, leaving the user believing the transaction was saved. Large CSV imports can also partially commit without a durable import-run summary. | `addTransaction()` is called without `await` and state resets immediately (`src/app/(app)/receipt-scanner/page.tsx:146-152`). Import writes are chunked and exact-dedupe makes reruns safer, but there is no import job/audit record. **Verified receipt defect; strongly indicated import-recovery gap.** | Await receipt writes, keep review open on failure, show saved ID, and add idempotency keys. Add import-run records with counts, errors, source hash, and safe resume/rollback information. Persist receipt files only after defining Storage rules/retention. | **Small (receipt, 0.5–1 day); medium (import runs, 3–5 days).** | Forced write failure leaves review data intact and shows recovery action; double-submit creates one record; interrupted import resumes without duplicates and reports committed/rejected rows. |
| **OPS-001** | **P1** | Recovery and production behavior are not provable from the repo. Firestore PITR/backups and alerts may or may not be active; App Hosting is capped at one instance, increasing latency/availability risk under concurrent webhooks/AI/jobs. | README lists these as pre-launch work (`README.md:226-253`), not completed evidence. `apphosting.yaml:4-5` sets `maxInstances: 1`. Structured logs exist, but no alert policy, SLO, restore drill, or runbook is versioned. **Verified configuration gap; operational state unverified.** | Verify/enable PITR and scheduled backups, perform a restore-to-isolated-database drill, add alert policies and runbooks, define RPO/RTO, and load-test before choosing a higher instance cap/concurrency setting. | **Medium, 3–7 days** plus observation. Cost increases are modest but must be budgeted. | Backup status is documented; quarterly restore drill succeeds; alerts fire in a controlled test; owners and response steps are named; load test meets agreed latency/error targets without dropped jobs. |

### Significant evidence and design implications

#### The main Reports kernel is the right foundation

`filterReportTransactions` applies date, posting status, possible-transfer, account, type, and nested-category filters to the same expanded transaction set (`src/lib/report-analytics.ts:237-271`). This is the pattern to reuse. It is also why dashboard/report differences should not be “fixed” with view-specific patches: every financial product surface should receive a versioned query specification and a versioned result from one kernel.

#### Transfers and designated funds are comparatively sound

`isFinancialTransaction`, `transferBalanceDelta`, and `transactionBalanceDelta` make transfers balance-only and require finalized provider state (`src/lib/accounts.ts:50-99`). Designated funds use that finalized predicate and calculate opening + received − spent (`src/lib/designated-funds.ts:29-83`). Acceptance tests should preserve these properties while other calculations are consolidated.

#### Plaid sync mechanics are stronger than the surrounding reconciliation model

The sync client follows Plaid's cursor pagination model and restarts on `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION` (`src/lib/plaid-sync.ts:103-145`). It uses stable provider IDs, preserves manual classification, inherits pending classification into posted items, retains removed status, uses leases, and verifies webhook JWT/body hashes. That aligns with Plaid's official guidance for [`/transactions/sync`](https://plaid.com/docs/transactions/) and `SYNC_UPDATES_AVAILABLE` webhooks. The missing layer is cross-source ownership: Plaid, CSV, manual entry, and recurring expectations need a shared reconciliation record so one real-world event cannot become multiple ledger events.

#### Firestore is isolated by user, but not a financial schema

UID matching prevents one normal client from reading another user's ledger. However, the wildcard rule is authorization only; it does not enforce transaction invariants. Firebase documents that rules can validate `request.resource.data` and compare it with existing state ([Firestore rules conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)). Server Admin routes must keep their own authorization because Admin bypasses Firestore rules.

## 4. B. Quick upgrades

These are modest improvements with high day-to-day value. They should follow or accompany the immediate correctness items where noted.

| ID | Pri. | Upgrade and impact | Evidence / confidence | Effort and dependencies | Acceptance criteria |
|---|---|---|---|---|---|
| **TEST-001** | **P1** | Golden-ledger reconciliation suite covering manual/Plaid, pending→posted, removed, transfers, splits, refunds, duplicates, parent/child categories, budgets, designated funds, recurring matches, leap years, time zones, and account filters. Benefits every user and future developer. | 111 unit tests pass, but no fixture asserts one ledger across Dashboard, Reports, Compare, Budget, Quarterly, EOY, and Forecast. **Verified gap.** | **Medium, 3–5 days.** First fixture can be smaller; add cases continuously. | A machine-readable matrix shows expected cent totals for every surface; CI fails on any cross-view mismatch. |
| **UX-001** | P2 | Add a reconciliation/source-health center: last bank sync, pending count, possible transfers, suspected duplicates, unmatched recurring expectations, stale balances, and one-click review. Reduces hidden data-quality work. | Pieces exist across Accounts and Needs Categorization but no single completion state. **Strongly indicated.** | **Medium, 3–5 days.** Depends on FIN-003/source model. | A user can see why accounts/reports are not “ready” and clear every exception without hunting across pages. |
| **UX-002** | P2 | Make budget cards explicit about period, as-of date, pending exclusion, prorating, and selected report filters. Add a drill-through to the exact contributing transactions. | Prior user confusion and the current budget/report defect show that a number without provenance is insufficient. **Verified need.** | **Small–medium, 2–3 days**, after FIN-001. | Clicking Actual opens a transaction list whose sum equals the card; labels identify dates, accounts, and exclusions. |
| **UX-003** | P2 | Turn receipt scanning into a review queue with durable image attachment, duplicate warning, extraction confidence, and keyboard/mobile batch review. | Current flow scans one image and prefills one transaction; no Storage path was found. **Verified partial implementation.** | **Medium, 1–2 weeks.** Requires Storage model/rules/retention and REL-001. | Receipt remains accessible from its transaction; failed extraction is recoverable; duplicates are flagged; delete/export policies are documented. |
| **DATA-002** | P2 | Add an export manifest and restore-friendly Ledgerly archive containing schema/calculation versions, IDs, settings, categories, accounts, and transaction data—not only presentation CSV/PDF. | Current exports are reports/tax artifacts, not a full-fidelity restore package. **Strongly indicated.** | **Medium, 3–5 days.** Depends on schema versioning. | Export validates against a schema; import into an isolated account reproduces the golden-ledger totals and preserves IDs/links. |
| **PERF-001** | P2 | Paginate/query transaction lists and move broad history calculations to bounded queries or versioned server aggregates. Measure reads before changing behavior. | Generic Firestore hooks subscribe to whole user collections; reports/chat/import can process all history. Route-level subscription flags help, but large ledgers will increase reads/render time. **Verified design; scaling impact exploratory.** | **Medium–large, 1–3 weeks.** Requires query indexes and correctness tests. | With a 100k-transaction synthetic ledger, initial page/read count and p95 interaction time meet targets; numbers match the unoptimized golden result. |
| **A11Y-001** | P2 | Add automated axe checks plus keyboard/screen-reader testing for navigation, dialogs, tables, charts, receipt review, and mobile filters. | Code contains thoughtful ARIA in several components, but no automated accessibility test suite was found. **Verified coverage gap.** | **Small–medium, 2–4 days** for baseline and critical fixes. | Critical journeys pass axe with no serious/critical issues and are completable by keyboard at 200% zoom. |
| **DOC-001** | P2 | Replace the stale blueprint with a dated capability matrix, data dictionary, metric definitions, and production runbooks. | `docs/blueprint.md` describes Apple auth and receipt attachment that are not implemented. **Verified.** | **Small, 1–2 days.** | Every metric has one definition/source; implemented/planned labels are explicit; setup and recovery steps are testable. |
| **MAINT-001** | P3 | Remove or justify unused Stripe dependencies and the apparently orphaned generated service worker; align fonts with Next's supported loading path. | Stripe packages are installed (`package.json:44,67`) but no billing flow was found; `public/sw.js` has old generated hashes and no registration was found; lint reports one font warning. **Strongly indicated.** | **Small, 0.5–1 day.** | Dependency/file removal produces no route/build/test change; lint warning is resolved; bundle diff is recorded. |

## 5. C. Long-term integrations and upgrades

### Ranking principles

The ranking favors user value, deterministic recovery, least-privilege access, and maintenance cost. Every financial integration should have:

1. A stable external source ID and Ledgerly source record.
2. Idempotent upsert semantics and a cursor/checkpoint.
3. A clearly declared source of truth for amount, date, status, category, receipt, and memo.
4. Pending/posted/removed/refund handling.
5. A reconciliation queue for ambiguous matches—not silent merging.
6. Read-only initial scope; outbound writes only after audit history and explicit approval.
7. Retry/dead-letter behavior, freshness status, disconnect/revoke handling, and re-sync from a checkpoint.

| Rank | ID | Pri. | Opportunity | Value / feasibility / evidence-confidence | Foundations, risk, and acceptance criteria |
|---:|---|---|---|---|---|
| 1 | **ORG-001** | P2 | Organizations, memberships, roles, approvals, and immutable audit history | **High value** for churches, bookkeepers, boards, and assistants. **Medium feasibility, high design responsibility.** The missing permission model is **verified**; demand is **strongly indicated** by intended church/team workflows. | Do before team-oriented integrations. Model owner/admin/bookkeeper/contributor/approver/viewer; server-enforce org scope; migrate personal ledgers safely. **Large, 4–8 weeks.** Acceptance: cross-org access tests, least-privilege matrix, audit event for every financial mutation, safe member removal. |
| 2 | **INT-PLAID-001** | P1 | Plaid production readiness plus reconciliation | **Very high value; high feasibility** because most code exists. Current implementation and official sync capabilities are **verified**; production institution behavior remains pilot-dependent. Ongoing Plaid fees/support are material. | First complete FIN-003, DATA-001, SEC-002, OPS-001. Current sync follows official cursor/webhook guidance; production still requires Plaid approval, production secret, OAuth institution testing, App Check, alerts, and relinking Sandbox items. **Medium, 2–4 weeks plus external approval.** Acceptance: pilot institutions pass link/update/relink/sync/remove/refund/recovery tests; every imported event reconciles once; freshness and failures are visible. |
| 3 | **APPROVAL-001** | P2 | Transaction review, budget-owner approval, close/lock periods, and exception workflow | **High value** for organizational use; **medium feasibility and maintenance.** Need is **strongly indicated** if Ledgerly serves teams, but exploratory for single-user use. | Depends on ORG-001/audit log. **Large, 3–6 weeks.** Acceptance: role matrix is enforced server-side; approvals are immutable and reversible through a documented correction event; closed periods cannot be silently rewritten. |
| 4 | **INT-ACCOUNTING-001** | P2 | Accounting-system export first; selective API integration later | **High practical value, medium feasibility.** Existing exports are **verified**; target-system demand and exact formats are **exploratory**. CSV/IIF/QBO-style export has much lower support burden than two-way sync. | Define Ledgerly as planning/operational source and accounting system as book-closing source, or vice versa—never both for the same field. **Medium, 2–4 weeks for robust exports; large for APIs.** Acceptance: balanced export, stable account/category mapping, period lock, validation report, repeat export without duplicates. |
| 5 | **INT-RAMP-001** | P3 | Read-only Ramp transactions, receipts, accounting fields, and reimbursements; consider write-back later | **High value for Ramp customers; medium feasibility; medium/high maintenance.** API capabilities are **verified**; Ledgerly-user demand is **exploratory**. Official Ramp APIs expose paginated transactions linked to receipts and accounting fields, plus read scopes for receipts and reimbursements ([Transactions](https://docs.ramp.com/developer-api/v1/api/transactions), [Authorization scopes](https://docs.ramp.com/developer-api/v1/scopes)). | Start with `transactions:read`, `receipts:read`, and only needed reimbursement scope. Ramp transaction ID is source key; refunds link to original; Ledgerly category mapping is separate. Do not enable `transactions:write` initially. **Large, 4–8 weeks.** Acceptance: incremental read sync/retry, attachment access control, duplicate-free Plaid/Ramp reconciliation, revoked-token recovery, clear field ownership. |
| 6 | **FIN-FUND-001** | P2 | Restricted/designated fund planning, releases, fund budgets, donor restrictions, and operating-vs-restricted statements | **High value for church/nonprofit users; medium feasibility.** The existing fund foundation is **verified**; broader donor-restriction workflow is **strongly indicated** by the product use case. | First fix category IDs/time/history. Add fund-event audit trail and rule validation. **Medium–large, 3–6 weeks.** Acceptance: opening + receipts − releases/spend = ending for every fund; operating statements exclude designated activity; split deposits reconcile once to bank total. |
| 7 | **INT-GIVING-001** | P3 | Giving-platform import adapters; APIs only for the dominant platforms | **High niche value, variable feasibility, high vendor-fragmentation burden.** Combined-deposit need is **verified** in the current product history; specific vendor/API demand is **exploratory**. | Begin with a guided CSV mapping/template and external gift ID. Support split deposits without duplicating the bank deposit. Add direct API only after usage data identifies the top platform. **Medium, 2–4 weeks per robust import; large per API.** Acceptance: donor/designation detail reconciles exactly to bank deposits; reruns are idempotent; donor PII is access-controlled and excluded from AI by default. |
| 8 | **INT-DOC-001** | P3 | Google Drive or Nextcloud document storage/import | **Medium value, medium feasibility, medium maintenance.** Provider capabilities are **verified**; continuous-sync value is **exploratory**. Google Drive supports file operations and change feeds/watch notifications ([Drive API](https://developers.google.com/workspace/drive/api/reference/rest/v3), [change feed](https://developers.google.com/workspace/drive/api/guides/manage-changes)); Nextcloud supports WebDAV, which is broadly deployable but varies by installation. | First create a provider-neutral attachment model with checksum, owner, retention, and permission metadata. Prefer user-initiated import/export before continuous two-way watching. **Medium, 3–6 weeks/provider.** Acceptance: least-privilege OAuth/app password, checksum dedupe, revocation, missing-file recovery, no public receipt URLs. |
| 9 | **OPS-JOBS-001** | P3 | General background job/webhook infrastructure | **Medium enabling value; medium feasibility.** Existing Plaid job/lease behavior is **verified**; need for a generalized platform is **exploratory until another integration ships**. | After integrations justify it, define a common job envelope, idempotency key, retry schedule, dead-letter queue, admin status, and metrics. Consider Cloud Tasks/Pub/Sub only when the App Hosting/Firestore queue no longer meets measured needs. **Medium–large, 2–5 weeks.** Acceptance: duplicate delivery is harmless; failed jobs are replayable; per-provider lag/error metrics exist. |
| 10 | **AI-001** | P3 | Reviewed categorization suggestions, anomaly detection, and plain-language financial explanations | **Medium/high value, technically feasible, but trust/privacy burden is high.** Current AI infrastructure is **verified**; added-user value and accuracy are **exploratory** and must be benchmarked. | Deterministic rules remain first; AI proposes rather than writes. Use redacted/minimized context, version prompts/models, retain explanation/confidence, and measure false positives. Depends on TEST-001/DATA-001/audit history. **Large, 4–8 weeks.** Acceptance: no autonomous financial mutation; user sees evidence and approves; benchmark precision/recall and cost limits are monitored. |

### Integration tradeoffs in plain language

- **Plaid before another bank-feed vendor:** Ledgerly already has a technically credible Plaid pipeline. Finishing reconciliation and production controls creates more value than maintaining two bank providers.
- **Ramp only for users who actually use Ramp:** Its official API can supply transactions, receipts, accounting fields, and reimbursements, but it overlaps Plaid for card activity. Ledgerly must identify the authoritative source per account and merge by stable IDs or reconciliation—not simply import both.
- **Exports before two-way accounting sync:** A validated, repeatable export is cheaper to support and easier to audit. Two-way QuickBooks or similar sync creates conflict-resolution and close-period responsibilities that should wait for organizations, roles, and audit history.
- **CSV first for giving/payroll:** Giving and payroll vendors are fragmented and often contain sensitive PII. A provider-neutral import with a saved mapping and reconciliation report captures most value while usage reveals which direct APIs are worth maintaining.
- **Document storage is not just “upload a file”:** receipt files need permission inheritance, retention/deletion, checksum dedupe, malware/content limits, and revocation behavior. Build the attachment model before choosing Firebase Storage, Drive, or Nextcloud as a provider.

## 6. Performance and operating-cost assessment

No production performance telemetry was available, so the following separates verified design facts from scaling hypotheses:

- **Verified:** shared Firestore hooks attach broad collection listeners, and `useAllTransactions` can load full history. Reports, designated funds, automatic goal calculations, chat context, and import dedupe may scan large in-memory arrays. This is acceptable for small ledgers but makes reads and browser work grow with total history.
- **Verified:** route-specific subscription flags already avoid loading some data on irrelevant screens. This is a good optimization to preserve.
- **Verified:** Plaid server aggregates and Firestore indexes exist, but the index set is limited to current access paths. Any pagination/filter refactor must add indexes deliberately.
- **Verified:** App Hosting is capped at one instance. This controls cost but can serialize bursts of AI requests, webhooks, scheduler jobs, and user traffic.
- **Exploratory:** actual slow pages, Firestore spend, and concurrency saturation are unknown. Add read-count, API latency, job-lag, and browser performance measurements before a large data-layer rewrite.
- **AI cost:** rate limiting and request-size validation are present. Add per-feature token/cost metrics and model fallbacks; never send full financial history when a deterministic summary is sufficient.

## 7. Security and privacy assessment

### Positive controls already present

- Per-user Firestore read isolation.
- Firebase ID-token authentication for server routes and recent-auth checks for destructive account deletion.
- Encrypted Plaid access tokens in server-only collections.
- Webhook signature/body verification, stable request IDs, structured server logs, distributed rate limiting, and secret-manager references rather than checked-in credentials.
- No credentials or personal financial records were printed or inspected during this review.

### Remaining controls

- Complete SEC-001 and SEC-002 before broad public use.
- Confirm Authentication authorized domains, email templates, reset flow, support email, and provider configuration through an isolated pilot; repository inspection cannot prove console state.
- Enable PITR or scheduled backups and test restoration. Firestore PITR can retain versions for up to seven days, while scheduled backups support longer disaster-recovery workflows ([PITR overview](https://docs.cloud.google.com/firestore/native/docs/pitr), [Firestore disaster recovery](https://docs.cloud.google.com/firestore/native/docs/disaster-recovery)).
- Decide whether financial data may be used by AI and document consent, retention, minimization, and deletion. Donor and receipt PII should be excluded unless explicitly needed.
- Before organizations, define whether the product is consumer, church/nonprofit, or business financial software for legal/privacy/compliance purposes. This materially changes retention, role, consent, and support requirements.

## 8. Phased roadmap

These are planning horizons, not delivery promises. Estimates assume one experienced full-time engineer with product access and timely review; security/legal/vendor approval work can extend elapsed time.

### Next two weeks

1. **SEC-001:** patch Next.js, align related packages, run regression/build/smoke checks.
2. **TEST-001:** establish the first golden ledger and cross-surface assertion matrix.
3. **FIN-001:** fix budget actual filtering and prove parity with Reports.
4. **FIN-002:** correct forecast scope/fallback; add “data sufficiency” language and backtest fixtures.
5. **REL-001 (receipt portion):** await the write, preserve failed review state, and prevent double-submit.
6. Start **OPS-001** verification: document whether PITR/backups/alerts are actually enabled; perform a non-production restore plan.

### Next 30–90 days

1. **FIN-003 (implemented in the current working diff):** recurring expectation-to-actual reconciliation and exception queue; add emulator and authenticated browser coverage before release.
2. **FIN-004 (implemented in the current working diff):** add isolated Firebase snapshot-generation and authenticated PDF/CSV browser smoke coverage before release.
3. **DATA-001 (implemented, rollout pending):** execute the documented dry run in an isolated/export workflow, resolve review records, and complete emulator/authenticated-browser release gates before any production migration.
4. **SEC-002 (repository implementation complete; rollout pending):** deploy the compatible app first, run authenticated browser smoke checks, deploy collection-specific rules, then observe and enforce App Check service by service. The exact order and rollback are in `docs/SECURITY_FIRESTORE_APPCHECK.md`.
5. **OPS-001:** backup/restore drill, alerting, RPO/RTO, scheduler/job runbook, and measured instance-cap decision.
6. **UX-001/UX-002:** reconciliation center and transaction-level number provenance.
7. Pilot **INT-PLAID-001** only after the above acceptance checks pass.

### Following 3–12 months

1. **ORG-001** and **APPROVAL-001** if shared church/business use is the intended market.
2. Complete Plaid production rollout with a limited pilot and support playbook.
3. Build **FIN-FUND-001** and robust accounting/giving exports before broad vendor APIs.
4. Implement **PERF-001** based on measured 10k/100k synthetic ledgers and production read/latency data.
5. Add one integration at a time: accounting export, then Ramp or the dominant giving platform based on user demand.
6. Add provider-neutral attachments before Drive/Nextcloud sync.
7. Add reviewed AI insights only after deterministic metrics, audit logs, and privacy policy are stable.

## 9. Ideas to defer

| Idea | Why defer it |
|---|---|
| Two-way accounting sync | Conflict resolution, close periods, and source ownership are not yet modeled. Start with validated exports. |
| Multiple bank-feed providers | Plaid is already implemented; another provider increases reconciliation and support burden before the current path is production-hardened. |
| Autonomous AI categorization or financial actions | Current calculations need convergence first. AI should remain reviewed and reversible. |
| Custom public API/MCP write access | Organizations, scopes, audit history, rate limits, and stable calculation contracts should precede third-party writes. A future read-only API can be considered after those foundations. |
| General-purpose workflow builder | High complexity and low near-term value compared with a focused reconciliation/approval queue. |
| Broad payroll API integration | Sensitive data and vendor fragmentation make a saved import/export mapping more practical initially. |
| Real-time collaboration/offline editing | Firestore can support it, but financial conflict semantics and period locks must be designed first. |
| Enabling AdSense | It adds privacy/consent and trust concerns to a financial product with little product benefit; it is correctly disabled now. |

## 10. Checks performed, limitations, and open questions

### Checks performed

- Read repository guidance, architecture notes, deployment configuration, Firebase rules/indexes, CI workflow, dependencies, data types, hooks, calculation libraries, APIs, and primary app routes.
- Traced transaction inclusion through accounts, transfers, reports, compare, budgets, forecasts, quarterly reports, EOY, designated funds, recurring materialization, imports, and Plaid normalization/sync.
- Ran `npm run check`:
  - ESLint: passed with one warning at `src/app/layout.tsx:54` about custom font loading.
  - TypeScript: passed.
  - Vitest: **29 files, 111 tests passed**.
- Ran `npm audit --omit=dev`: **93 production dependency entries** (5 critical, 19 high, 69 moderate). Direct findings include Next (critical, patch available), Zod (high, major update required), Firebase (high transitive, no npm-suggested fix at review time), Firebase Admin/Genkit transitive findings. Counts are not the same as 93 independently exploitable Ledgerly defects; each advisory needs reachability and vendor-version triage.
- Attempted production build locally. Compilation succeeded in an initial run but prerendering stopped because no local Firebase public environment values were present. A retry with CI-style dummy values was blocked by the execution sandbox when Turbopack attempted to create a local process/port. CI is configured to run the full build. This does not prove the deployed build is broken, but a complete local production build was not independently verified.
- Reviewed official Plaid, Ramp, Google Drive, Nextcloud, and Firebase documentation for the integration/operations claims cited in this report.

### Access limitations

- The initial assessment had no isolated Firebase environment. Release preparation subsequently added fail-closed Auth/Firestore emulator wiring, a synthetic two-user dataset, and authenticated Chromium checks. These do not prove production configuration or provider behavior.
- Production Firestore records, Authentication users, Plaid items, receipts, logs, costs, performance metrics, secrets, and console configuration were intentionally not inspected or changed.
- Backup/PITR, scheduler, monitoring, Authentication provider, authorized-domain, and App Check console state cannot be established from the repository alone.
- Synthetic records are now confined to the dedicated emulator project IDs. No production records were read or written; actual production incidence/frequency remains unknown.
- Mobile/accessibility observations are code-level only, not a device/screen-reader usability study.

### Questions that materially affect the roadmap

These questions do not block the corrections above, but they change long-term order:

1. Is Ledgerly primarily for one person, a household, a church/nonprofit team, or a small business? If teams are a target, ORG-001 moves ahead of most integrations.
2. Which system is intended to be the official book of record: Ledgerly or an accounting product? This determines sync direction and period-lock rules.
3. Should a scheduled recurring item be a forecast expectation only, or should users be allowed to post it as an actual before bank confirmation? The reconciliation design can support both, but the state names must be explicit.
4. What reporting time zone and base currency should a ledger use? Are multi-currency accounts in scope?
5. How should refunds and reimbursements affect category budgets: reduce original spending, appear as income, or be user-selectable with a recommended default?
6. What recovery objectives are acceptable (for example, maximum 24 hours of data loss and four hours to restore), and what monthly infrastructure/integration budget is acceptable?
7. Which giving, payroll, accounting, and corporate-card platforms are used by the first ten target organizations? Usage data should choose integrations, not feature checklists.

## 11. First three implementation tasks

### 1. SEC-001 — patch Next.js and re-run the complete release gate

**Why first:** it is the only P0, has a compatible patch, and reduces current external risk without changing Ledgerly's financial model.

**Verification:** no Next critical remains in the audit; lockfile review shows expected changes; lint, typecheck, unit tests, production build, auth, PDF export, image/receipt flow, API routes, and Plaid webhook smoke tests pass in a test environment.

### 2. TEST-001 — create the golden ledger reconciliation suite

**Why second:** the upcoming fixes touch definitions users rely on. A shared fixture turns “these pages look close” into an enforceable contract and protects transfers, splits, designated funds, and nested categories that already work well.

**Verification:** CI runs one fixture through Dashboard, Reports, Compare, Budget, Quarterly, EOY, designated funds, balances, and forecast inputs; all deterministic totals match explicit cent values and every exclusion is asserted.

### 3. FIN-001 — correct budget actuals using the canonical financial filter

**Why third:** it is a confirmed wrong-money defect with small implementation effort and an obvious parity oracle in the main Reports kernel.

**Verification:** a budget drill-down and Reports with the same dates/accounts/categories have identical contributing transaction IDs and cent totals; pending, removed, possible-transfer, and transfer fixtures contribute zero; split allocations contribute exactly their allocated amount once.

---

The next implementation request should reference these IDs. The recommended first batch is **SEC-001 + TEST-001 + FIN-001**, followed by **FIN-002** after the golden forecast fixtures are in place.
