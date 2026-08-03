# Ledgerly Plaid setup checklist

The code integration is complete. These steps connect it to a real Plaid
application and the deployed Firebase App Hosting backend. Do not paste Plaid
secrets, encryption keys, job secrets, or service-account files into chat,
GitHub, source code, or a browser-visible `NEXT_PUBLIC_` variable.

## 1. Decisions needed from the owner

- Plaid environment for the next rollout: `sandbox`, `development`, or
  `production`. Start with Sandbox unless Plaid has approved production access.
- Countries to support. The current configuration is United States (`US`).
- Import window. The current request is 730 days; each institution may provide
  less history.
- Whether to enable paid/on-demand real-time Balance calls. The default is
  `false`; cached balances still update during sync.
- Confirm the production URLs:
  - Webhook: `https://ledgerly.business/api/plaid/webhook`
  - OAuth redirect: `https://ledgerly.business/accounts`

## 2. Plaid Dashboard work

1. Create or open the Ledgerly Plaid application.
2. Copy the Client ID and the secret for the chosen environment into a secure
   password manager temporarily.
3. Enable/request the Transactions product.
4. Request Balance access only if real-time balance refresh is desired.
5. Add the webhook and OAuth redirect URLs shown above.
6. Complete Plaid branding, privacy-policy, terms, institution, and production
   access reviews before switching `PLAID_ENV` to `production`.

## 3. Create server-only Firebase secrets

From the project folder, create the four secret names already referenced by
`apphosting.yaml`:

```bash
firebase apphosting:secrets:set PLAID_CLIENT_ID
firebase apphosting:secrets:set PLAID_SECRET
firebase apphosting:secrets:set PLAID_TOKEN_ENCRYPTION_KEY
firebase apphosting:secrets:set PLAID_JOB_SECRET
```

Use the Plaid Client ID and environment-specific Plaid secret for the first two.
Generate the other values locally, then paste each only into the Firebase secret
prompt:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

The base64 value is `PLAID_TOKEN_ENCRYPTION_KEY`; the hex value is
`PLAID_JOB_SECRET`. Back up the encryption key securely. Losing or replacing it
without a token migration will make existing stored Plaid access tokens
unreadable, requiring users to reconnect.

## 4. Confirm deployment configuration

Review `apphosting.yaml` before rollout:

- Set `PLAID_ENV` to the same environment as `PLAID_SECRET`.
- Keep `PLAID_COUNTRY_CODES=US` or provide the approved comma-separated list.
- Keep or adjust `PLAID_DAYS_REQUESTED=730`.
- Set `PLAID_REALTIME_BALANCE_ENABLED=true` only after Balance access and cost
  are approved.
- Confirm the webhook and redirect URLs match the active domain exactly.

## 5. Deploy Firestore security and indexes

```bash
firebase deploy --only firestore
```

This keeps encrypted access tokens, item-owner mappings, and webhook jobs
server-only while allowing each signed-in user to read their safe connection
status.

## 6. Configure background processing

Create a Cloud Scheduler HTTP job that runs every few minutes:

- Method: `POST`
- URL: `https://ledgerly.business/api/plaid/jobs/process`
- Header: `Authorization: Bearer <PLAID_JOB_SECRET>`

Create a second daily job using the same method and header:

- URL: `https://ledgerly.business/api/plaid/jobs/process?scheduled=1`

The first drains verified webhook jobs with retries. The second refreshes
connections that have not synced recently.

## 7. Sandbox acceptance test

1. Roll out the backend after the secrets exist.
2. Sign into a non-production Ledgerly test user.
3. Open Accounts and select **Connect bank**.
4. Use a Plaid Sandbox institution and map one account to a new Ledgerly
   account. Also test linking an institution account to an existing Ledgerly
   account to confirm it does not duplicate the balance.
5. Verify pending transactions are visible but excluded from reports, account
   balances, budgets, goals, forecasts, and posted envelope spending.
6. Categorize one transaction manually, then sync again and confirm the manual
   choice remains locked.
7. Create a merchant rule, apply it, and confirm future matching imports use it.
8. Confirm a possible transfer appears in Needs Categorization and stays out of
   income/expense totals until resolved.
9. Confirm Accounts shows cached institution balances and a balance timestamp.
10. Test Link update mode and both disconnect options with test-only data.

## Information to send back to Codex

Do not send secret values. Send only:

- “The four Firebase secret names have been created.”
- Chosen Plaid environment.
- Approved countries and history window.
- Whether real-time Balance should be enabled.
- Confirmation or corrections for the webhook and OAuth redirect URLs.
- Whether the two Cloud Scheduler jobs are configured.
- Whether the Sandbox acceptance test passed, including any visible error text
  or screenshots if something failed.
