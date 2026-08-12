import "server-only";

import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebaseAdmin";

export async function checkDistributedRateLimit({
  key,
  limit,
  windowMs,
  now = Date.now(),
}: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
  const id = createHash("sha256").update(key).digest("hex");
  const reference = adminDb.collection("rateLimitBuckets").doc(id);
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const values = snapshot.data();
    const storedStart = values?.windowStartedAt as Timestamp | undefined;
    const storedStartMs = storedStart instanceof Timestamp ? storedStart.toMillis() : 0;
    const windowStartedAt =
      !storedStartMs || storedStartMs + windowMs <= now ? now : storedStartMs;
    const count = windowStartedAt === storedStartMs ? Number(values?.count ?? 0) + 1 : 1;
    const resetAt = windowStartedAt + windowMs;
    transaction.set(reference, {
      count,
      windowStartedAt: Timestamp.fromMillis(windowStartedAt),
      updatedAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(resetAt + 24 * 60 * 60 * 1000),
    });
    return {
      allowed: count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1_000)),
    };
  });
}
