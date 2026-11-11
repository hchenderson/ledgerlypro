import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 600_000,
  expect: { timeout: 45_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:9002",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    acceptDownloads: true,
    navigationTimeout: 60_000,
    actionTimeout: 45_000,
  },
});
