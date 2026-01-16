
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "@/lib/firebase-admin";

export async function requireUid(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/);

  if (!match) {
    throw new Error("Missing Authorization Bearer token");
  }

  const idToken = match[1];
  const decoded = await getAuth(adminApp).verifyIdToken(idToken);
  return decoded.uid;
}
