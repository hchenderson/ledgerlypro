# SEC-002 Firestore and App Check rollout

Status: repository implementation complete; production deployment and Firebase Console enforcement are intentionally pending.

## Access inventory and permissions matrix

All client data is scoped below `users/{uid}`. Firestore rules require the authenticated UID to equal the path UID. Firebase Admin bypasses rules, so every Admin route must establish its own caller identity before reading or writing user data.

| Collection | Owner client read | Owner client write | Trusted write path and notes |
|---|---:|---:|---|
| `transactions` | Yes | Validated create/update/delete | Manual/import transactions and atomic paired transfers are client workflows. Plaid provenance/status, provider-derived amount/date, recurring links, and refund links are protected. Plaid sync, `/api/recurring/reconcile`, and `/api/refunds/link` own those fields. |
| `accounts` | Yes | Validated manual CRUD | Plaid IDs, institution balances/status, and estimated-opening metadata are server-owned through Plaid routes/sync. Connected accounts cannot be deleted directly. |
| `categories`, `budgets`, `goals` | Yes | Validated CRUD | Client-owned setup data with allowed-key, type, enum, range, and document-ID checks. |
| `recurringTransactions` | Yes | Validated schedule CRUD | `lastAddedDate` is server-owned. Materialized expectations are separate and server-only. |
| `envelopes`, `envelopeEvents` | Yes | Validated CRUD | Client batches preserve current envelope workflows. Cross-document available-funds math remains application validation. |
| `accountReconciliations` | Yes | Create/delete only | Audit-style records are immutable after creation. |
| `splitTemplates`, `designatedFunds`, `reportViews` | Yes | Validated CRUD | User configuration; nested maps/lists are size-bounded at the rules layer and fully validated by application code. |
| `financialSummaries` | Yes | No | `/api/financial-summaries/rebuild` reads the owner's ledger and writes the compatibility cache through Admin. It is never accepted from a client or used as the source for immutable reports. |
| `settings/main` | Yes | Validated create/update | Only the `main` document is accessible; known keys, year ranges, modes, balance range, and time-zone string are checked. |
| `categorizationRules` | Yes | No | `/api/categorization/rules` performs authenticated atomic rule/audit writes. |
| `reports` | Yes | No | `/api/reports/quarterly` creates immutable revisions and handles explicit deletion. |
| `recurringOccurrences`, `recurringReconciliationEvents` | Yes | No | `/api/recurring/process` and `/api/recurring/reconcile`. |
| `refundAuditEvents`, `categorizationAudit` | Yes | No | Created only by authenticated Admin routes. |
| `plaidItems`, `balanceSnapshots` | Yes | No | Plaid routes and sync own these safe client-readable records. |
| Unknown `users/{uid}` subcollections | No | No | Deny by default until a collection contract is reviewed. |
| `plaidSecrets`, `plaidItemOwners`, `plaidWebhookInbox`, `plaidOperations`, `rateLimitBuckets` | No | No | Operational/server-only at the root. |

The authenticated `/api/account/clear-data` route now performs the destructive multi-collection cleanup that previously attempted direct client deletes of audit and snapshot collections. Categorization rule mutations likewise moved to a server transaction so the rule and immutable audit event cannot diverge. Financial-summary writes, including resetting a cleared year to zero, now use `/api/financial-summaries/rebuild` rather than a browser write.

## Financial and provenance protections

- DATA-001 legacy dollar/date records remain editable. New client-created manual transactions may dual-write exact integer cents and a date-only ledger day; cents must agree with dollars.
- Plaid source identity, source amount/currency/date/timestamps, posting/removal status, provider metadata, and sync state cannot be added, changed, or removed by a client.
- A user may still classify a provider transaction, but cannot directly change its provider-derived amount or ledger date.
- Recurring occurrence links and refund links are server-only. A linked recurring actual also protects the amount, date, direction, and account until it is unlinked through the reconciliation API.
- A transfer requires two reciprocal transaction records in the same atomic write. A paired transfer must also be deleted atomically.
- Reports, recurring/refund audit events, Plaid records, and reconciliation events cannot be mutated directly.

Firestore rules cannot safely sum arbitrary split lists, prove a category-tree reference, enforce a single primary account, calculate envelope availability, or validate all report math. Those invariants remain in the typed application calculation/route code. Rules prevent schema/provenance bypass; they do not make an owner's intentionally entered manual financial data truthful.

## Admin-route authorization audit

| Route class | Authorization |
|---|---|
| Account, AI, chat, categorization, EOY, financial-summary rebuild, Plaid user actions, recurring, refunds, and quarterly reports | `requireUid` validates Firebase Auth, then scopes every Firestore path to that UID. SEC-002 also verifies App Check according to the configured mode. |
| Full account deletion | `requireRecentUid` verifies a non-revoked, recently authenticated ID token before destructive Admin work. |
| Plaid job processor | Server-only bearer value from `PLAID_JOB_SECRET`; not a browser route. |
| Plaid webhook | Plaid webhook JWT/body-hash verification plus server-side item-owner lookup. |
| Plaid configuration | Public, deliberately returns only non-secret readiness/environment values. |

Admin SDK calls are unaffected by Firestore client rules. Route authentication, input schemas, ownership-derived document paths, transaction preconditions, and audit records are therefore required even after App Check enforcement. App Check is an abuse signal, not a replacement for Firebase Auth or these ownership checks.

## Emulator verification

Run:

```bash
npm run test:rules
```

The command starts only the local Firestore emulator for project `ledgerly-sec002-test`. The 16 tests use two synthetic users and cover owner queries/listeners, cross-user and anonymous denial, canonical/legacy records, malformed money/dates, protected source/reconciliation/refund fields, atomic transfer pairs, representative setup batches, server-only collections, root operational collections, and the known previous-client incompatibilities. The same isolated emulator exercises the actual FIN-003 reconciliation, DATA-001 refund, and financial-summary route handlers, including idempotent retry, competing recurring matches, refund link/unlink, and clearing cached totals after ledger deletion.

No production project ID, credentials, or records are used.

## App Check staged rollout

Ledgerly already initializes the Firebase Web App Check SDK early with a reCAPTCHA Enterprise provider, enables token auto-refresh, attaches `X-Firebase-AppCheck` to custom authenticated API calls, and verifies the header with the Admin SDK. `FIREBASE_APP_CHECK_MODE` now makes the server behavior explicit:

- `off`: no custom-route verification; intended only for isolated local work.
- `monitor`: validate supplied tokens and log missing/invalid/unavailable results, but do not reject the request.
- `enforce`: reject missing or invalid tokens. Firebase Auth is still required separately.

The old `FIREBASE_APP_CHECK_ENFORCED=true|false` variable remains a compatibility fallback. New deployments should use the mode variable. App Hosting is prepared for `monitor`, not enforcement.

Recommended release order:

1. Deploy the application code first with the web app registered in **Firebase Console → Security → App Check**, a production score-based reCAPTCHA Enterprise key in `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`, and `FIREBASE_APP_CHECK_MODE=monitor`. This must precede rules deployment because older clients still write categorization audits and financial-summary caches directly and perform clear-data cleanup from the browser.
2. Smoke-test sign-in, manual/import transactions, category/budget/account/envelope edits, recurring reconciliation, refund link/unlink, reports, categorization rules, clear-data, and Plaid user actions. Confirm custom-route logs show valid App Check traffic rather than missing/invalid tokens.
3. Deploy Firestore rules. Re-run the same workflows and review permission-denied logs. Do not proceed if any legitimate query, listener, or batch is denied.
4. In **Security → App Check → APIs**, observe Cloud Firestore and Authentication metrics. Firebase classifies traffic as verified, outdated (missing token), invalid, or reused. Wait until supported user traffic is verified and investigate every legitimate outdated/invalid source.
5. Change custom routes to `FIREBASE_APP_CHECK_MODE=enforce` in a separately reviewed rollout. Watch App Hosting 401 rates and the structured monitor diagnostics.
6. Enforce Cloud Firestore in the Firebase Console. Enforce Authentication separately only after its own metrics are clean. Service enforcement is independent from the custom Next.js route mode and can take several minutes to propagate.
7. Keep authorization rules and ID-token validation in place. App Check enforcement never weakens or replaces them.

Rollback is service-specific: return custom routes to `monitor` with an App Hosting rollout, or switch the affected Firebase API from enforced to unenforced in the App Check console. This restores legitimate outdated clients while retaining Firestore authorization and schema rules. Diagnose the affected app version/domain before re-enforcing.

For local/CI browser work after enforcement, set `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG=true` only in a non-production build, collect the generated debug token from that isolated browser, and register it in the Firebase Console. Never put a debug token in source, an environment file committed to Git, or a production build. Delete a compromised token immediately. The code refuses to enable this switch in a production build.

Official guidance used for the rollout:

- [Web App Check with reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Monitor App Check metrics](https://firebase.google.com/docs/app-check/monitor-metrics)
- [Enable enforcement](https://firebase.google.com/docs/app-check/enable-enforcement)
- [Protect a custom backend](https://firebase.google.com/docs/app-check/web/custom-resource)
- [Verify custom-backend tokens](https://firebase.google.com/docs/app-check/custom-resource-backend)
- [Web debug provider](https://firebase.google.com/docs/app-check/web/debug-provider)

## Remaining release gates

- Production console registration, telemetry observation, Firestore/Auth enforcement, and rules deployment remain unperformed.
- Authenticated browser smoke tests now pass against isolated Auth and Firestore emulators for the new app with both captured baseline rules and proposed rules. The browser suite covers manual create/edit, denied provider edit with input preservation, transfer, CSV import, stubbed receipt save, budget actuals, recurring confirmation, reporting time zone, Quarterly, EOY, CSV, and PDF download. It does not prove production App Check attestation, live Plaid behavior, or that the captured baseline equals deployed production rules.
- The previous-client combination is verified at the rules layer, not with an exact previous browser build. Old direct categorization writes fail, and old sequential clear-data can partially complete before a protected deletion is denied. Deploy the app first and require old tabs to refresh before publishing rules.
- See `docs/RELEASE_CANDIDATE_CHECKLIST.md` for the current decision, evidence, rollout, and rollback sequence.
- Run the DATA-001 aggregate-only migration dry run against an access-controlled export and review all flagged legacy conflicts before any production conversion.
