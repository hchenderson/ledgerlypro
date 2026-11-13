import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { RELEASE_PROJECT_ID, seedReleaseFixture } from "./seed-emulators";

const required = {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
};

const env = {
  ...process.env,
  GCLOUD_PROJECT: RELEASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${RELEASE_PROJECT_ID}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: RELEASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${RELEASE_PROJECT_ID}.appspot.com`,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:release-test",
  NEXT_PUBLIC_FIREBASE_USE_EMULATORS: "true",
  NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST: required.FIRESTORE_EMULATOR_HOST,
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: required.FIREBASE_AUTH_EMULATOR_HOST,
  LEDGERLY_ISOLATED_TEST: "true",
  LEDGERLY_EXTERNAL_SERVICES_MODE: "stub",
  FIREBASE_APP_CHECK_MODE: "off",
  NEXT_PUBLIC_ADSENSE_ENABLED: "false",
  PLAID_ENV: "sandbox",
};

async function main() {
  for (const [key, expected] of Object.entries(required)) {
    if (process.env[key] !== expected) throw new Error(`${key} must equal ${expected}.`);
  }
  Object.assign(process.env, env);
  await seedReleaseFixture();

  let app: ChildProcess | null = null;
  const stop = () => {
    if (app && !app.killed) app.kill("SIGTERM");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  try {
    app = spawn("npm", ["run", "dev"], { env, stdio: ["ignore", "pipe", "pipe"] });
    app.stdout?.on("data", (chunk) => process.stdout.write(`[app] ${chunk}`));
    app.stderr?.on("data", (chunk) => process.stderr.write(`[app] ${chunk}`));
    const deadline = Date.now() + 90_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (app.exitCode !== null) throw new Error(`Next.js exited with code ${app.exitCode}.`);
      try {
        const response = await fetch("http://127.0.0.1:9002/signin");
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(500);
    }
    if (!ready) throw new Error("Next.js did not become ready.");

    for (const pathname of [
      "/dashboard",
      "/reports",
      "/reports/eoy",
      "/transactions",
      "/receipt-scanner",
      "/recurring",
      "/settings",
      "/budgets",
    ]) {
      const response = await fetch(`http://127.0.0.1:9002${pathname}`);
      if (response.status >= 500) {
        throw new Error(`Route warmup failed for ${pathname} with ${response.status}.`);
      }
    }

    const playwrightArgs = ["playwright", "test"];
    if (process.env.LEDGERLY_E2E_GREP) {
      playwrightArgs.push("--grep", process.env.LEDGERLY_E2E_GREP);
    }
    const playwright = spawn("npx", playwrightArgs, { env, stdio: "inherit" });
    const exitCode = await new Promise<number>((resolve) => playwright.on("exit", (code) => resolve(code ?? 1)));
    if (exitCode !== 0) process.exitCode = exitCode;
  } finally {
    stop();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
