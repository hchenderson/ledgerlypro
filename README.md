# Ledgerly Pro

Ledgerly Pro is a private, Firebase-backed finance workspace for tracking
transactions, budgets, goals, recurring commitments, reports, and forward-looking
cash-flow analysis. The web application is built with Next.js and uses Genkit for
receipt extraction and narrative projections.

## Requirements

- Node.js 20 or newer (CI uses Node.js 20.20.2)
- npm
- A Firebase project with Authentication and Firestore enabled
- A Google AI API key for the AI features
- A Plaid account for automatic bank connections (optional; Sandbox works for development)

## Financial data conventions

Ledgerly is currently a USD-only ledger. New financial writes store authoritative
integer cents alongside a legacy-compatible dollar field, and new transaction
dates use a date-only ledger day. The owner-selected reporting time zone controls
legacy timestamp conversion and report/forecast boundaries. Confirmed linked
refunds are account credits that reduce expense in the original category on the
refund date; they are never counted as ordinary income.

See [`docs/DATA_CONVENTIONS.md`](docs/DATA_CONVENTIONS.md) for field ownership,
rounding, refund, dry-run migration, rollout, and rollback rules. The DATA-001
production migration is deliberately not run by application startup or deployment.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the required values into `.env.local`. Environment files are ignored by
   Git.

   ```dotenv
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
   NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=
   NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG=false
   FIREBASE_APP_CHECK_MODE=off
   NEXT_PUBLIC_ADSENSE_ENABLED=false
   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/ledgerly-pro-service-account.json
   GEMINI_API_KEY=
   PLAID_CLIENT_ID=
   PLAID_SECRET=
   PLAID_ENV=sandbox
   PLAID_TOKEN_ENCRYPTION_KEY=
   PLAID_JOB_SECRET=
   PLAID_COUNTRY_CODES=US
   PLAID_DAYS_REQUESTED=730
   PLAID_REALTIME_BALANCE_ENABLED=false
   PLAID_WEBHOOK_URL=http://localhost:9002/api/plaid/webhook
   PLAID_REDIRECT_URI=http://localhost:9002/accounts
   PLAID_BALANCE_SNAPSHOT_RETENTION_DAYS=400
   ```

   To create the local Admin credential file, open Firebase Console, select
   **Ledgerly Pro**, then go to **Project settings → Service accounts → Firebase
   Admin SDK → Generate new private key**. Keep the downloaded JSON file outside
   this repository and set `GOOGLE_APPLICATION_CREDENTIALS` to its full path.
   Never commit or share that file.

   Plaid values are server-only. Generate the two local secrets with:

   ```bash
   openssl rand -base64 32  # PLAID_TOKEN_ENCRYPTION_KEY
   openssl rand -hex 32     # PLAID_JOB_SECRET
   ```

   Use the Client ID and Sandbox secret from the Plaid Dashboard. A local
   webhook requires an HTTPS tunnel; manual Sync works without one.

   Firebase App Hosting uses its managed service identity and does not need this
   local credential file. Configure `GEMINI_API_KEY` as a runtime secret in the
   Firebase console for the deployed backend.

3. Start the application:

   ```bash
   npm run dev
   ```

   The default local URL is `http://localhost:9002`.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:rules
npm run build
```

Run the complete non-build verification suite with `npm run check`. Pull requests
run checks and a production build through GitHub Actions.

## Genkit development

The AI flows live under `src/ai/flows` and are exposed to the browser only through
authenticated Next.js API routes under `src/app/api/ai`. Start the Genkit developer
UI with:

```bash
npm run genkit:watch
```

AI endpoints validate request sizes and schemas, use Firestore-backed rate limits
that work across App Hosting instances, and can require Firebase App Check tokens.
Collection permissions, protected fields, emulator coverage, and the staged App
Check release procedure are documented in
[`docs/SECURITY_FIRESTORE_APPCHECK.md`](docs/SECURITY_FIRESTORE_APPCHECK.md).
The current controlled-rollout decision, validation evidence, production gates,
and rollback sequence are in
[`docs/RELEASE_CANDIDATE_CHECKLIST.md`](docs/RELEASE_CANDIDATE_CHECKLIST.md).

## Architecture

- `src/app` — Next.js routes and authenticated application screens
- `src/components` — reusable UI and report/dashboard components
- `src/hooks` — authentication and user-data subscriptions
- `src/lib` — deterministic financial calculations, Firebase clients, and APIs
- `src/forecast` — forecasting and trajectory calculations
- `src/ai` — Genkit configuration and model-backed flows
- `firestore.rules` — per-user Firestore access boundary

Recurring schedules are expanded by the authenticated `/api/recurring/process`
endpoint into server-managed expectations under
`users/{uid}/recurringOccurrences`; they are not ledger transactions. Each
occurrence has a stable schedule-plus-original-due-date ID and snapshots its
expected amount, category, account, and due date. Schedule edits or deletion do
not rewrite an already-created occurrence or its reconciliation history.

The Recurring page reviews possible actual matches. Candidates must have the same
account and direction, post from five days early through seven days late, and have
an amount within the larger of $5 or 10%; a normalized merchant match also permits
a changed amount or partial payment. Every suggestion, even an unambiguous one,
requires confirmation. Confirm, dismiss, undo-link, skip, and provider-invalidation
decisions are handled by `/api/recurring/reconcile` in Firestore transactions and
record a small audit event. One actual cannot fulfill multiple occurrences. A
partial payment leaves the unpaid expectation in the forecast; a skipped occurrence
is omitted. If a linked provider transaction is removed or becomes ineligible, the
occurrence becomes an exception, its remaining expectation returns to the forecast,
and Ledgerly never silently chooses another actual.

The finalized actual amount and posting date are authoritative for balances,
budgets, and reports. The expected amount and original due date remain visible for
variance review. Confirmed recurring actuals remain in the ledger but are excluded
from the forecast's historical merchant/category estimates because the schedule owns
that future projection. Older generated records with explicit `source: recurring`
and a schedule ID are compatibility candidates; description-prefix-only records are
reported for manual review and are never reclassified automatically. Legacy
transaction-backed envelope events from explicit generated expectations are also
ignored by envelope calculations; the records remain stored for traceability.
Confirming a legacy pair marks the generated entry as expectation-only and keeps the
bank/manual actual authoritative. Undoing the link restores the occurrence's
remaining forecast amount but does not turn the old generated entry back into a
financial actual. Category, description, and notes on a linked manual actual remain
editable, but match-defining fields such as amount, date, direction, account, and
posting state require undoing the link first. Plaid provider updates use the server
path to refresh the confirmed amount/date or surface an exception.

Multi-account data lives in `users/{uid}/accounts`, with each transaction and
recurring entry assigned to an account. Transfers are stored as an atomically linked
pair of balance-only entries and are excluded from income, expense, budget, and
cash-flow metrics. Statement reconciliations are audit records: a mismatch is saved
for review and never changes transactions automatically. Potential transfer matches
also require user confirmation before either entry is reclassified.

Envelope budgeting is an opt-in layer (`tracking`, `envelope`, or `hybrid`) over the
account ledger. Envelope definitions live in `users/{uid}/envelopes`; immutable
allocation activity lives in `users/{uid}/envelopeEvents`. Funding, release, return,
unassignment, and reallocation actions reuse linked account transfers, while an
assigned expense or refund creates a deterministic envelope event in the same batch
as its transaction. Standard income, expense, cash-flow, comparison, quarterly, and
EOY calculations continue to ignore transfers. The envelope report intentionally
reports allocation movement separately.

Monthly and yearly reports use the deterministic calculation pipeline in
`src/lib/report-analytics.ts`. The same filtered transaction set supplies summary
cards, charts, category movement, insights, budget performance, transaction detail,
and CSV exports. Account balances are calculated separately from the complete
ledger so category filters cannot turn a real account balance into a partial cash-flow
number. Named report configurations live in `users/{uid}/reportViews` and include
dates, account/category/status filters, comparison settings, visible metrics, and
section order. Compare accepts an exact-date handoff from Reports and uses the shared
category-key resolver in `src/lib/financial-category.ts`.

Quarterly and End-of-Year reports compose that same finalized-financial contract:
date range, account scope, category scope, and posting status are explicit, and
pending, removed, possible-transfer, transfer, and forecast-only recurring records
stay outside income and expense totals. Stable category IDs survive renames;
duplicate display names remain separate; deleted/unknown IDs and records without a
resolvable category appear as explicit unresolved or uncategorized rows. Category
rows and CSV/PDF source data reconcile to the displayed financial totals.

Quarterly snapshots created with calculation version 4 are immutable revisions.
They store their effective filters and saved results. Running the same report again
creates a new revision instead of overwriting the original. Older snapshots remain
readable with their original values and are labeled as legacy. Because Ledgerly did
not historically store dated goal events, new historical reports say quarter-end
goal progress is unavailable and show progress captured at report generation
separately; they do not present current goal state as historical.

Budget and Dashboard cards use the account-filtered transaction set supplied by
their page and the canonical finalized-financial predicate. Pending, removed,
possible-transfer, and transfer records contribute zero; split expenses contribute
their reporting allocations once. A parent budget card intentionally shows spending
for its entire category subtree, so parent and child cards can overlap and must not
be added together. The Reports budget aggregate instead assigns each expense to the
most-specific matching budget so its overall Actual total reconciles to report
expenses for the same dates and account filters.

The Dashboard forward forecast uses the pure calculation kernel in
`src/forecast/forward-forecast.ts`. “Next 90 Days” means 90 local calendar days,
including today and ending 89 days later. Observed history ends immediately before
today and uses the preceding 26 weeks of posted, non-transfer financial activity.
Split allocations are expanded once; pending, removed, possible-transfer, and
transfer records contribute zero to projected income and expenses. The selected
account scope applies to history, schedules, opening balance, and projections; an
empty account selection means all accounts. Projected net is projected income minus
projected expenses, and projected ending balance is the opening account balance plus
projected net.

Historical estimates partition each reporting line once: repeat merchant patterns
are modeled first, repeat category activity is modeled from the remainder, and all
sparse activity shares one residual fallback per direction. Unused categories cannot
multiply the fallback. Explicit recurring expectations contribute zero to financial
results. A confirmed actual fulfills its occurrence, removes that occurrence from
scheduled projections, and is not reused as a history-based projection. Unmatched
expectations remain forecast-only. The
shaded chart range is a historical-variability guide, not a statistical confidence
interval; the displayed line and totals always use the deterministic calculation.

Combined bank deposits and payments can carry `allocations` on the original
transaction. The account ledger and reconciliation always use that source transaction
once; category, budget, dashboard, Compare, quarterly, EOY, assistant-context, CSV,
and PDF calculations expand it into allocation lines through
`src/lib/transaction-allocations.ts`. Allocation amounts must reconcile to the source
amount in cents. Reusable percentage-based split templates live in
`users/{uid}/splitTemplates`.

Designated-fund definitions live in `users/{uid}/designatedFunds`. Each definition
pairs one or more received categories with one or more sent/spent categories and an
opening balance as of a confirmed date. The Designated tab on Reports shows church
operations with those categories removed and separately reconciles each fund as
opening balance + received - sent = ending amount held.

For an account-backed envelope, releasing funds to the Main account does not reduce
the envelope's available amount. It increases `reservedInOperating` until an expense
assigned to that envelope posts or unused funds are returned. Funding suggestions,
paycheck percentages, target-date plans, and rollover rules are advisory; Ledgerly
does not initiate bank transfers automatically.

## Firebase deployment

Firebase client data is stored below `users/{uid}` and protected by
`firestore.rules`. Deploy rules and the App Hosting backend through the Firebase
console or Firebase CLI associated with the target project. Do not commit local
environment files or service-account credentials.

## Plaid bank connections

The Accounts page includes Plaid Link, explicit account mapping, transaction
sync, cached institution balances, optional real-time balance checks, Link
update mode, connection health, and disconnect controls. Plaid access tokens
are AES-256-GCM encrypted in `plaidSecrets/{uid}/items/{itemId}`; that collection,
the item-owner lookup, and webhook inbox are never client-readable. Safe status
metadata is stored below `users/{uid}/plaidItems`.

Plaid transactions use deterministic Firestore IDs. Pending transactions are
visible but excluded from balances, reports, budgets, goals, forecasts, and
envelope spending. When a pending transaction posts, its user-confirmed
category and envelope assignment carry forward. Removed provider transactions
are excluded and retained for review when necessary. Manual classifications are
locked and always win over Plaid categories and automation rules.

Before deploying Plaid:

1. Create Firebase secrets named `PLAID_CLIENT_ID`, `PLAID_SECRET`,
   `PLAID_TOKEN_ENCRYPTION_KEY`, and `PLAID_JOB_SECRET`. The names already match
   `apphosting.yaml`.
2. Set `PLAID_ENV` to `sandbox` or `production`. Plaid Trial plans use the
   Production environment with a limited number of real connections. Replace
   the Sandbox secret whenever the environment changes.
3. In the Plaid Dashboard, allow the Transactions product, configure
   `https://ledgerly.business/api/plaid/webhook`, and add
   `https://ledgerly.business/accounts` as the OAuth redirect URI.
4. Deploy Firestore rules and indexes: `firebase deploy --only firestore`.
5. Configure Cloud Scheduler to POST
   `https://ledgerly.business/api/plaid/jobs/process` with
   `Authorization: Bearer <PLAID_JOB_SECRET>` every few minutes. Webhooks enqueue
   quickly; this processor performs the durable transaction sync and retries.
   Add a second daily request to the same URL with `?scheduled=1` to refresh
   healthy connections even when no webhook was received.
6. Keep `PLAID_REALTIME_BALANCE_ENABLED=false` until Balance product access and
   pricing are approved. Cached balances continue to update during normal sync.

Plaid connections are tagged with the environment in which they were created.
Sandbox tokens are never sent to Production (or vice versa); users disconnect and
relink after an environment change. The Accounts page also resumes OAuth redirects
using the original Link token kept temporarily in browser session storage.

Completed webhook jobs expire after 30 days, permanently failed jobs after 90 days,
and balance snapshots after `PLAID_BALANCE_SNAPSHOT_RETENTION_DAYS` (400 by default).
The TTL policies live in `firestore.indexes.json` and do not activate until the
Firestore configuration is deployed.

The default history request is 730 days. Institutions may return less history.
Ledgerly estimates an opening balance from the first imported activity and the
institution current balance; linked existing accounts keep their user-entered
opening balance. Review that estimate during the first reconciliation.

## Production readiness

Before allowing public signups:

1. Obtain Plaid Trial or Production access, use the matching Production secret,
   set `PLAID_ENV=production`, and create a new rollout. Existing Sandbox Items
   must be disconnected and relinked.
2. Create a score-based reCAPTCHA Enterprise website key for the production
   domain. Register it under **Firebase Console → App Check**, then add its public
   site key as `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` in App Hosting. Roll out
   with `FIREBASE_APP_CHECK_MODE=monitor`, verify valid App Check traffic, and
   only then change it to `enforce` in a separately reviewed rollout. Firebase
   service enforcement is enabled independently in **Security → App Check**.
3. In Firebase Authentication, verify the Google and Email/Password providers,
   authorized domains, support email, sender name, verification-email template,
   password-reset template, and action URL. Password signups must verify their
   email before they can sign in.
4. Deploy `firestore.rules` and `firestore.indexes.json`. The latter activates
   automatic cleanup for job, balance-snapshot, and rate-limit documents.
5. Create Cloud Monitoring alerts for App Hosting 5xx responses, instance or
   latency spikes, failed Plaid job logs, and billing budgets. Enable Firestore
   point-in-time recovery or scheduled exports before a public launch.
6. Have qualified counsel review the Privacy Policy and Terms for the business,
   jurisdiction, advertising choices, and financial-data use. AdSense remains
   disabled unless `NEXT_PUBLIC_ADSENSE_ENABLED=true`; do not enable it until the
   required consent and publisher configuration are complete.
7. Test sign-up verification, password reset, Google sign-in, Plaid OAuth on a
   mobile device, initial import and categorization, webhook sync, reconnect,
   disconnect, exports, and full account deletion with pilot users before widening
   access.

## Exported workspace

This repository originated in Firebase Studio. Reusable local build and preview
instructions are recorded in `.agents/workflows` for environments importing the
export, including Antigravity-compatible workspaces.
