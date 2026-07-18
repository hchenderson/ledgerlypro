// /lib/firebaseAdmin.ts
import "server-only";

import { cert, getApps, initializeApp, App, type ServiceAccount } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;
let adminCredentialIssue: string | null = null;

function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const privateKey = typeof parsed.private_key === "string"
      ? parsed.private_key.replace(/\\n/g, "\n")
      : "";
    if (
      parsed.type !== "service_account" ||
      typeof parsed.project_id !== "string" ||
      typeof parsed.client_email !== "string" ||
      !privateKey.includes("-----BEGIN PRIVATE KEY-----")
    ) {
      return null;
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey,
    };
  } catch {
    return null;
  }
}

try {
  if (getApps().length) {
    adminApp = getApps()[0];
  } else {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const isGoogleManagedRuntime = Boolean(
      process.env.FIREBASE_CONFIG ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.K_SERVICE
    );
    const hasCredentialFile = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

    const serviceAccount = isGoogleManagedRuntime || hasCredentialFile
      ? null
      : parseServiceAccount(raw);
    const defaultAppOptions = projectId ? { projectId } : undefined;

    if (!serviceAccount) {
      // App Hosting supplies Application Default Credentials automatically.
      // Local development can use `gcloud auth application-default login`.
      adminApp = initializeApp(defaultAppOptions);
    } else {
      try {
        adminApp = initializeApp({ credential: cert(serviceAccount) });
      } catch {
        adminCredentialIssue =
          "FIREBASE_SERVICE_ACCOUNT_JSON contains an invalid private key. " +
          "Use GOOGLE_APPLICATION_CREDENTIALS with a newly downloaded service-account file.";
        adminApp = initializeApp(defaultAppOptions);
      }
    }
  }

  if (adminApp) {
    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);
  }
} catch (error) {
  console.error("Firebase Admin SDK initialization failed:", error);
}

export { adminApp, adminDb, adminAuth, adminCredentialIssue };
