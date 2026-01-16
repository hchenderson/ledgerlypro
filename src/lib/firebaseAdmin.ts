// /lib/firebaseAdmin.ts
import "server-only";

import { cert, getApps, initializeApp, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env var.");
  }

  const parsed = JSON.parse(raw);

  // Fix escaped newlines in private_key (very common in env vars)
  if (typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }

  return parsed;
}

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const serviceAccount = getServiceAccount();

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

export const adminApp = getAdminApp();
export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
