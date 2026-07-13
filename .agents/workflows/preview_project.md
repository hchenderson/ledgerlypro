# Preview Ledgerly Pro

1. Open a terminal in the repository root.
2. Confirm `.env.local` contains the Firebase client variables and any AI keys
   needed for the features being tested.
3. Install dependencies with `npm ci` if `node_modules` is absent or stale.
4. Start the web preview with:

   ```bash
   npm run dev -- --hostname 0.0.0.0 --port 9002
   ```

5. Open `http://localhost:9002` and verify the landing page renders.
6. Sign in and smoke-test the dashboard, transactions, recurring commitments,
   reports, projections, and receipt scanner.
7. Confirm browser and terminal logs contain no uncaught errors.
8. Stop the preview with Ctrl+C when testing is complete.
