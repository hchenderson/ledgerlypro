# Ledgerly controlled release candidate

Prepared: 2026-11-10

## Candidate identity and decision

- Branch: `codex/priority-batch-sec-test-fin`
- Base and current committed `HEAD`: `4b34887bbafe6ee39c65bbe8af4b78634f18b17b`
- Candidate: the complete, uncommitted working-tree diff on that commit. It contains SEC-001, TEST-001, FIN-001 through FIN-004, DATA-001, SEC-002, and the release-preparation fixes listed below.
- Production data, Firebase settings, published rules, App Check enforcement, commits, pushes, merges, and deployments were not changed.

**Decision: NO-GO for the complete production rollout today.** The code candidate passes the isolated release gates and is suitable for review, but production-only gates remain: verify the rules currently deployed in Firebase, register/configure the production App Check web provider and build-time public site key, and confirm the production backup/PITR state. After those are recorded, the first authorized action should be an **application-only rollout**. Stricter rules and every App Check enforcement switch remain separate later decisions.

The DATA-001 backfill does **not** need to precede the application rollout. Mixed legacy/canonical reads passed the calculation, rules, browser, and synthetic analyzer checks. Production analysis, backup verification, and a restore rehearsal are mandatory before a later backfill.

## Isolated validation results

| Gate | Result | Evidence and boundary |
|---|---|---|
| Unit and golden-ledger suite | PASS | `36` files, `172` tests. Deterministic financial totals include the `$1,200` income, `$223` checking expense, `$273` all-account expense, `$977` checking net, and `$927` all-account net cases. |
| Firestore rules and Admin route suite | PASS | `2` files, `16` tests against the Firestore emulator. Covers two-user isolation, owner queries/listeners, canonical/legacy writes, protected provider/refund/recurring fields, atomic transfers, recurring retries/competition, refund link/unlink, immutable summaries/reports/audits, and the old-client partial-clear hazard. |
| New app + proposed rules | PASS | Authenticated Chromium flow against Auth and Firestore emulators. Manual create/edit, denied provider edit with form preservation, transfer, CSV import, receipt save, budget actuals, recurring confirmation, time-zone update, Reports, Q1 Quarterly, EOY, CSV, and PDF download all completed. External Plaid/AI behavior was stubbed; static Google Font requests were blocked and no external data-service request escaped localhost. |
| New app + captured baseline rules | PASS | The same authenticated flow passed against `tests/release-baseline.rules`, captured from base commit `4b34887`. **Its equivalence to the rules currently deployed in production is unverified.** |
| Previous/open old client + proposed rules | PARTIAL / INCOMPATIBLE | Rule-level reproduction proves the old client cannot directly write categorization rules/audits and that its sequential clear-data workflow can delete ordinary collections before an immutable-report deletion is denied. An exact previous-version browser run was not performed because that code has no isolated browser-emulator wiring. Users must refresh to the new app before proposed rules are published. |
| TypeScript | PASS | `npm run typecheck`. |
| Lint | PASS with warning | No errors; one existing `no-page-custom-font` warning in `src/app/layout.tsx`. |
| Production build | PASS | Next.js `15.5.29` Turbopack build with synthetic Firebase configuration; 48 static pages generated. This was build validation, not production authentication. |
| Dependency audit | CONDITIONAL PASS | `npm audit --omit=dev`: `0` critical, `17` high, `70` moderate. Next.js is on the current fixed `15.5.x` security patch. Remaining findings need tracked dependency migrations; no verified critical exposed path remains in this candidate. |
| DATA-001 synthetic dry run | PASS | 7 mixed transactions: 1 clean, 1 canonical, 5 review; 3 amount conversions, 3 date conversions, 0 period changes, 1 balance change. Review reasons: fractional cent, canonical conflict, ambiguous date, unsupported currency, and split mismatch. |
| Production DATA-001 dry run | PENDING | No authorized production export was available. Run the aggregate-only command below against an access-controlled copy. |
| `git diff --check` | PASS | No whitespace errors in the complete accumulated candidate diff. Re-run after any review edits and before committing. |

Receipt extraction and Plaid/provider transitions were simulated. Refund atomicity is covered through the normal server API in the emulator suite; no dedicated refund-link browser UI exists in this checkout. PDF creation was exercised in Chromium and unit-tested as a valid PDF; CSV rows and deterministic export totals have calculation-level parity tests.

## Release-blocking defects fixed during preparation

1. Canonical transaction edits now update `amountMinor` with `amount`, preventing a saved edit from displaying or calculating the old value.
2. CSV import no longer sends an `undefined` allocation field to Firestore.
3. Quarterly date selection opens on the selected reference month, and saved quarter boundaries display in the report's reporting time zone (`Q1` ends March 31, not April 1 in a UTC browser).
4. Receipt-created transactions now await the Firestore write, retain the selected category across rerenders, and preserve date-only receipt dates without a one-day UTC shift.
5. Next.js and `eslint-config-next` were advanced to `15.5.29`, the smallest `15.5.x` release containing the November 2026 official security fixes.
6. Isolated browser/Admin configuration fails closed on the wrong project ID, emulator host, or emulator port. Test mode stubs receipt extraction and does not use production Plaid or Gemini credentials.

## Required production checks before changing anything

1. In Firebase Console, open **Firestore Database → Rules**. Export/copy the active rules and compare them with the verified production release reference. Do not assume `tests/release-baseline.rules` is deployed. Record the rules version/time.
2. In **Firestore Database → Backups** and Google Cloud Firestore settings, record PITR/backup status and the most recent usable recovery point. Do not run DATA-001 backfill until a separate isolated restore rehearsal succeeds.
3. In Google Cloud **reCAPTCHA Enterprise / Fraud Defense**, create a score-based Web key for every real Ledgerly domain. Do not add `localhost` to the production key.
4. In **Firebase Console → Security → App Check → Apps**, register the Ledgerly Web app with that reCAPTCHA Enterprise key. Leave Firestore and Authentication enforcement off.
5. In **App Hosting → Backend → Settings → Environment**, add the public `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` value with build and runtime availability. This is a public browser key, not a secret. Keep `FIREBASE_APP_CHECK_MODE=monitor`.
6. Verify the App Hosting service identity still has access to the existing Plaid secrets referenced by `apphosting.yaml`. Do not rotate secrets as part of this release.

## Exact rollout order and rollback triggers

### 1. Review, commit, and CI — repository action after approval

Commit the exact reviewed diff, push the branch, and run CI with Node 20. CI must rerun install, lint, typecheck, unit tests, Firestore emulator tests, and the production build. Re-run both isolated browser commands if the committed diff differs from this candidate.

**Stop/rollback trigger:** any changed lockfile resolution, failed gate, missing build-time App Check site key, or unexpected production configuration diff.

### 2. Roll out application code only

Create one Firebase App Hosting rollout for the new application. Do **not** publish `firestore.rules` and do **not** enable App Check enforcement in the same step.

Check immediately:

- Sign in and refresh an already-signed-in browser.
- Create/edit one controlled test transaction in an authorized test ledger, then remove it.
- Open Reports, Quarterly, EOY, Accounts, Budgets, Recurring, and Needs Categorization.
- Download one CSV and PDF and compare the visible totals.
- Confirm custom-route logs show `FIREBASE_APP_CHECK_MODE=monitor` diagnostics and no rise in 401/403/5xx responses.
- Confirm Plaid webhook/job health and that no Sandbox calls occur in production unexpectedly.

**Rollback trigger:** authentication loop, financial mismatch, write loss, route error spike, missing App Check tokens from the new app, or provider sync regression. Roll back the App Hosting application to the prior rollout. Current rules remain unchanged, so application rollback is independent at this stage.

### 3. Allow old clients to drain

Keep the app-only release live long enough to cover representative desktop/mobile users and cached tabs. Tell users to refresh/reopen Ledgerly before the rules change. Specifically warn against using categorization-rule edits or **Clear all data** from an already-open old tab.

**Proceed evidence:** no unexplained client errors, normal write/query traffic, valid App Check tokens from supported domains, and confirmation that the active production rules baseline was recorded.

### 4. Publish proposed Firestore rules as a separate change

Publish `firestore.rules` only. Immediately repeat transaction, transfer, import, receipt, budgets, categorization-rule, recurring, refund API, reports, and clear-data smoke checks.

**Rollback trigger:** any legitimate `permission-denied`, failed listener/query, partial batch, or unexplained write error. Restore the verified prior rules immediately; keep the new application deployed because it passed the baseline-rules combination.

### 5. Observe App Check; do not enforce yet

Monitor custom-route structured logs plus **Security → App Check → Firestore/Authentication metrics** for a representative traffic window. Investigate every legitimate outdated, invalid, or reused-token source. There is no arbitrary percentage threshold: proceed only when all supported domains/app versions are represented and unexplained legitimate failures are resolved.

### 6. Later, separately authorize enforcement

In separate reversible decisions: enforce custom routes by changing `FIREBASE_APP_CHECK_MODE` to `enforce`; later enforce Firestore in Console; later enforce Authentication. Smoke-test and observe errors after each individual switch.

**Rollback:** return custom routes to `monitor` with an App Hosting rollback/config rollout, or disable enforcement for only the affected Firebase service. Never loosen user authorization rules to compensate for App Check failures.

## DATA-001 production analysis and backfill

Run against an access-controlled JSON export/copy, never a public or committed file:

```bash
npm run migration:data001:dry-run -- /absolute/path/to/authorized-export.json America/New_York
```

Report aggregate counts only. The application can ship first in mixed-record mode. Backfill later only after:

1. Backup/PITR verification.
2. A restore rehearsal into an isolated project.
3. Production dry-run review of every conflict, period change, and balance change.
4. Checkpointed batch plan and rollback criteria.
5. Pre/post comparison of account balances, budget actuals, Reports, Quarterly, EOY, and exports.

## Checks to rerun after approval

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:rules
npm run build
npm run test:e2e:baseline
npm run test:e2e:isolated
git diff --check
```

Use documented synthetic configuration for the build and local emulators. Do not use production credentials for CI or browser tests.
