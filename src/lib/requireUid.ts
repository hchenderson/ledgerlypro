import "server-only";
import { adminAppCheck, adminAuth } from "@/lib/firebaseAdmin";
import { resolveAppCheckMode, type AppCheckMode } from "@/lib/app-check-policy";
import { AuthenticationError, extractBearerToken } from "@/lib/auth-token";

export { AuthenticationError } from "@/lib/auth-token";

export type { AppCheckMode } from "@/lib/app-check-policy";

export function appCheckMode(): AppCheckMode {
  return resolveAppCheckMode({
    FIREBASE_APP_CHECK_MODE: process.env.FIREBASE_APP_CHECK_MODE,
    FIREBASE_APP_CHECK_ENFORCED: process.env.FIREBASE_APP_CHECK_ENFORCED,
  });
}

function appCheckDiagnostic(
  outcome: "missing" | "invalid" | "unavailable",
  req: Request,
) {
  console.warn("Firebase App Check request not verified", {
    outcome,
    method: req.method,
    path: new URL(req.url).pathname,
  });
}

export async function verifyRequestAppCheck(req: Request) {
  const mode = appCheckMode();
  if (mode === "off") return;
  if (!adminAppCheck) {
    if (mode === "enforce") throw new Error("Firebase App Check is not initialized.");
    appCheckDiagnostic("unavailable", req);
    return;
  }
  const token = req.headers.get("x-firebase-appcheck");
  if (!token) {
    if (mode === "enforce") throw new AuthenticationError("Missing Firebase App Check token");
    appCheckDiagnostic("missing", req);
    return;
  }
  try {
    await adminAppCheck.verifyToken(token);
  } catch {
    if (mode === "enforce") throw new AuthenticationError("Invalid Firebase App Check token");
    appCheckDiagnostic("invalid", req);
  }
}

export async function requireUid(req: Request): Promise<string> {
  if (!adminAuth) {
    throw new Error("Firebase Admin SDK is not initialized. Check server configuration.");
  }
  await verifyRequestAppCheck(req);
  const idToken = extractBearerToken(req.headers.get("authorization"));
  const decoded = await adminAuth.verifyIdToken(idToken);
  return decoded.uid;
}

export async function requireRecentUid(
  req: Request,
  maximumAgeSeconds = 5 * 60,
): Promise<string> {
  if (!adminAuth) {
    throw new Error("Firebase Admin SDK is not initialized. Check server configuration.");
  }
  await verifyRequestAppCheck(req);
  const idToken = extractBearerToken(req.headers.get("authorization"));
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const authTime = Number(decoded.auth_time ?? 0);
  if (!authTime || Math.floor(Date.now() / 1000) - authTime > maximumAgeSeconds) {
    throw new AuthenticationError("Please sign in again before deleting your account.");
  }
  return decoded.uid;
}
