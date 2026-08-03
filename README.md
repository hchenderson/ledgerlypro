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

AI endpoints validate request sizes and schemas and apply a per-instance rate
limit. For production abuse protection across multiple instances, enable Firebase
App Check or replace the in-memory limiter with a shared store.

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
2. Set `PLAID_ENV` to `sandbox`, `development`, or `production`. Replace the
   Sandbox secret whenever the environment changes.
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

The default history request is 730 days. Institutions may return less history.
Ledgerly estimates an opening balance from the first imported activity and the
institution current balance; linked existing accounts keep their user-entered
opening balance. Review that estimate during the first reconciliation.

## Exported workspace

This repository originated in Firebase Studio. Reusable local build and preview
instructions are recorded in `.agents/workflows` for environments importing the
export, including Antigravity-compatible workspaces.
