import "server-only";

import { adminAuth } from "@/lib/firebaseAdmin";

function base64Url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export async function createBudgetViewerCustomToken(uid: string, emailKey: string) {
  if (!adminAuth) throw new Error("Firebase Admin SDK is not initialized.");
  const claims = { ledgerlyRole: "budget_viewer", viewerKey: emailKey };
  if (process.env.LEDGERLY_ISOLATED_TEST === "true") {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    if (projectId !== "ledgerly-release-demo" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099") {
      throw new Error("Isolated custom-token mode requires the release Auth emulator.");
    }
    const now = Math.floor(Date.now() / 1_000);
    return `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({
      iss: "owner",
      sub: "owner",
      aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
      iat: now,
      exp: now + 3_600,
      uid,
      claims,
    })}.`;
  }
  return adminAuth.createCustomToken(uid, claims);
}
