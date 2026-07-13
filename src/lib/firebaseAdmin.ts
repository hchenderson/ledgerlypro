// /lib/firebaseAdmin.ts
import "server-only";

import { cert, getApps, initializeApp, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;

try {
  if (getApps().length) {
    adminApp = getApps()[0];
  } else {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      throw new Error("Firebase Admin SDK initialization failed: Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable. Please check your server configuration.");
    }
    const serviceAccount = JSON.parse(raw);
    if (typeof serviceAccount.private_key === "string") {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    adminApp = initializeApp({ credential: cert(serviceAccount) });
  }

  if (adminApp) {
    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);
  }
} catch (e: any) {
  console.error("Firebase Admin SDK initialization failed:", e);
}

export { adminApp, adminDb, adminAuth };
