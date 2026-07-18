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
   ```

   To create the local Admin credential file, open Firebase Console, select
   **Ledgerly Pro**, then go to **Project settings → Service accounts → Firebase
   Admin SDK → Generate new private key**. Keep the downloaded JSON file outside
   this repository and set `GOOGLE_APPLICATION_CREDENTIALS` to its full path.
   Never commit or share that file.

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

## Firebase deployment

Firebase client data is stored below `users/{uid}` and protected by
`firestore.rules`. Deploy rules and the App Hosting backend through the Firebase
console or Firebase CLI associated with the target project. Do not commit local
environment files or service-account credentials.

## Exported workspace

This repository originated in Firebase Studio. Reusable local build and preview
instructions are recorded in `.agents/workflows` for environments importing the
export, including Antigravity-compatible workspaces.
