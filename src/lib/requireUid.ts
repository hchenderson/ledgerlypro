import "server-only";
import { adminAuth } from "@/lib/firebaseAdmin";

export async function requireUid(req: Request): Promise<string> {
  if (!adminAuth) {
    throw new Error("Firebase Admin SDK is not initialized. Check server configuration.");
  }
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer (.+)$/);

  if (!match) throw new Error("Missing Authorization Bearer token");

  const idToken = match[1];
  const decoded = await adminAuth.verifyIdToken(idToken);
  return decoded.uid;
}
