"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from "firebase/auth";
import { getToken } from "firebase/app-check";

import { appCheck, firebaseConfig } from "@/lib/firebase";

const APP_NAME = "ledgerly-budget-portal";
const portalApp = getApps().some((candidate) => candidate.name === APP_NAME)
  ? getApp(APP_NAME)
  : initializeApp(firebaseConfig, APP_NAME);

export const budgetPortalAuth = getAuth(portalApp);

const globalState = globalThis as typeof globalThis & {
  __ledgerlyBudgetPortalAuthReady?: Promise<void>;
  __ledgerlyBudgetPortalEmulatorConnected?: boolean;
};

if (
  process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true"
  && !globalState.__ledgerlyBudgetPortalEmulatorConnected
) {
  const host = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (host !== "127.0.0.1:9099" && host !== "localhost:9099") {
    throw new Error("Budget Portal isolated testing requires Auth on localhost:9099.");
  }
  connectAuthEmulator(budgetPortalAuth, `http://${host}`, { disableWarnings: true });
  globalState.__ledgerlyBudgetPortalEmulatorConnected = true;
}

export function prepareBudgetPortalAuth() {
  globalState.__ledgerlyBudgetPortalAuthReady ??= setPersistence(
    budgetPortalAuth,
    browserSessionPersistence,
  );
  return globalState.__ledgerlyBudgetPortalAuthReady;
}

export async function budgetPortalFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (appCheck) {
    const token = await getToken(appCheck, false);
    headers.set("x-firebase-appcheck", token.token);
  }
  return fetch(input, { ...init, headers });
}

export async function authenticatedBudgetPortalFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  await prepareBudgetPortalAuth();
  const user = budgetPortalAuth.currentUser;
  if (!user) throw new Error("Your budget session has expired.");
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${await user.getIdToken()}`);
  return budgetPortalFetch(input, { ...init, headers });
}
