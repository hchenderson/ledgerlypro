# Build Ledgerly Pro

1. Open a terminal in the repository root.
2. Confirm Node.js 20 or newer is active with `node --version`.
3. Install the locked dependencies with `npm ci`.
4. Run lint, TypeScript, and unit tests with `npm run check`.
5. Create the production build with `npm run build`.
6. Treat any failed command as a failed build; do not deploy with ignored errors.

For intentional dependency updates, use `npm install` first, review the resulting
`package.json` and `package-lock.json`, then repeat steps 4 and 5.
