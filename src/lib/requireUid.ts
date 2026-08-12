import "server-only";
import { adminAppCheck, adminAuth } from "@/lib/firebaseAdmin";
import { AuthenticationError, extractBearerToken } from "@/lib/auth-token";

export { AuthenticationError } from "@/lib/auth-token";

async function requireAppCheck(req: Request) {
  if (process.env.FIREBASE_APP_CHECK_ENFORCED !== "true") return;
  if (!adminAppCheck) throw new Error("Firebase App Check is not initialized.");
  const token = req.headers.get("x-firebase-appcheck");
  if (!token) throw new AuthenticationError("Missing Firebase App Check token");
  try {
    await adminAppCheck.verifyToken(token);
  } catch {
    throw new AuthenticationError("Invalid Firebase App Check token");
  }
}

export async function requireUid(req: Request): Promise<string> {
  if (!adminAuth) {
    throw new Error("Firebase Admin SDK is not initialized. Check server configuration.");
  }
  await requireAppCheck(req);
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
  await requireAppCheck(req);
  const idToken = extractBearerToken(req.headers.get("authorization"));
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const authTime = Number(decoded.auth_time ?? 0);
  if (!authTime || Math.floor(Date.now() / 1000) - authTime > maximumAgeSeconds) {
    throw new AuthenticationError("Please sign in again before deleting your account.");
  }
  return decoded.uid;
}
