import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createPortalChallengeId,
  createPortalPin,
  normalizePortalEmail,
  portalEmailKey,
  portalPinVerifier,
  portalSourceKey,
} from "@/lib/budget-portal-crypto";
import { portalPinEmail } from "@/lib/budget-portal-email";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestAppCheck } from "@/lib/requireUid";

const inputSchema = z.object({ email: z.string().email().max(320) });
const PIN_TTL_MS = 10 * 60 * 1_000;
const RESEND_COOLDOWN_MS = 60 * 1_000;

function sourceAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export async function POST(request: Request) {
  try {
    await verifyRequestAppCheck(request);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const { email: submittedEmail } = inputSchema.parse(await request.json());
    const email = normalizePortalEmail(submittedEmail);
    const emailKey = portalEmailKey(email);
    const sourceKey = portalSourceKey(sourceAddress(request));
    const [emailLimit, sourceLimit] = await Promise.all([
      checkDistributedRateLimit({ key: `budget-pin-email:${emailKey}`, limit: 6, windowMs: 60 * 60 * 1_000 }),
      checkDistributedRateLimit({ key: `budget-pin-source:${sourceKey}`, limit: 30, windowMs: 60 * 60 * 1_000 }),
    ]);
    if (!emailLimit.allowed || !sourceLimit.allowed) {
      return NextResponse.json(
        { accepted: true, message: "If budget access is available, a code will be sent shortly." },
        { status: 202, headers: { "retry-after": String(Math.max(emailLimit.retryAfterSeconds, sourceLimit.retryAfterSeconds)) } },
      );
    }

    const now = Date.now();
    const pin = createPortalPin();
    const challengeId = createPortalChallengeId();
    const stateRef = adminDb.collection("budgetPortalPinStates").doc(emailKey);
    const challengeRef = adminDb.collection("budgetPortalChallenges").doc(challengeId);
    const grants = await adminDb.collection("budgetPortalGrants").where("emailKey", "==", emailKey).get();
    const deliverable = grants.docs.some((document) => document.data().status !== "revoked");
    const created = await adminDb.runTransaction(async (transaction) => {
      const state = await transaction.get(stateRef);
      const nextAllowedAt = Number(state.data()?.nextAllowedAt?.toMillis?.() ?? 0);
      if (nextAllowedAt > now) return false;
      const previousChallengeId = state.data()?.activeChallengeId;
      if (typeof previousChallengeId === "string") {
        const previousRef = adminDb!.collection("budgetPortalChallenges").doc(previousChallengeId);
        const previous = await transaction.get(previousRef);
        if (previous.exists && previous.data()?.status === "active") {
          transaction.update(previousRef, { status: "superseded", updatedAt: Timestamp.fromMillis(now) });
        }
      }
      transaction.create(challengeRef, {
        emailKey,
        verifier: portalPinVerifier(challengeId, pin),
        status: "active",
        attempts: 0,
        maximumAttempts: 5,
        deliverable,
        sourceKey,
        createdAt: Timestamp.fromMillis(now),
        updatedAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + PIN_TTL_MS),
      });
      transaction.set(stateRef, {
        activeChallengeId: challengeId,
        nextAllowedAt: Timestamp.fromMillis(now + RESEND_COOLDOWN_MS),
        updatedAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + 30 * 24 * 60 * 60 * 1_000),
      });
      return true;
    });

    if (created && deliverable) {
      try {
        await portalPinEmail(email, pin, challengeId);
        await challengeRef.update({ deliveryStatus: "sent", updatedAt: Timestamp.now() });
      } catch {
        await challengeRef.update({ deliveryStatus: "failed", updatedAt: Timestamp.now() });
      }
    }
    return NextResponse.json({
      accepted: true,
      challengeId: created ? challengeId : undefined,
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
      message: "If budget access is available, a code will be sent shortly.",
    }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    return NextResponse.json({ error: "Budget code delivery is temporarily unavailable." }, { status: 503 });
  }
}
