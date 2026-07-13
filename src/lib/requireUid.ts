import "server-only";
import { adminAuth } from "@/lib/firebaseAdmin";
import { extractBearerToken } from "@/lib/auth-token";

export { AuthenticationError } from "@/lib/auth-token";

export async function requireUid(req: Request): Promise<string> {
  if (!adminAuth) {
    throw new Error("Firebase Admin SDK is not initialized. Check server configuration.");
  }
  const idToken = extractBearerToken(req.headers.get("authorization"));
  const decoded = await adminAuth.verifyIdToken(idToken);
  return decoded.uid;
}
