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
   FIREBASE_APP_CHECK_ENFORCED=false
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

## Architecture

- `src/app` — Next.js routes and authenticated application screens
- `src/components` — reusable UI and report/dashboard components
- `src/hooks` — authentication and user-data subscriptions
- `src/lib` — deterministic financial calculations, Firebase clients, and APIs
- `src/forecast` — forecasting and trajectory calculations
- `src/ai` — Genkit configuration and model-backed flows
- `firestore.rules` — per-user Firestore access boundary

Recurring occurrences are materialized by the authenticated
`/api/recurring/process` endpoint. Occurrence document IDs are deterministic, so a
retry or a second browser session updates the same occurrence instead of creating a
duplicate.

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
   with `FIREBASE_APP_CHECK_ENFORCED=false`, verify valid App Check traffic, and
   only then change it to `true` and roll out again.
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
