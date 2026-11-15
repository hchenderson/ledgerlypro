import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { portalPinVerifier, portalVerifierMatches, portalSourceKey } from "@/lib/budget-portal-crypto";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestAppCheck } from "@/lib/requireUid";
import { createBudgetViewerCustomToken } from "@/lib/budget-portal-token";

const inputSchema = z.object({
  challengeId: z.string().min(20).max(100),
  code: z.string().regex(/^\d{6}$/),
});

function sourceAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export async function POST(request: Request) {
  try {
    await verifyRequestAppCheck(request);
    if (!adminAuth || !adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const input = inputSchema.parse(await request.json());
    const sourceKey = portalSourceKey(sourceAddress(request));
    const sourceLimit = await checkDistributedRateLimit({
      key: `budget-pin-verify:${sourceKey}`,
      limit: 30,
      windowMs: 15 * 60 * 1_000,
    });
    if (!sourceLimit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Wait before trying again." }, { status: 429 });
    }
    const challengeRef = adminDb.collection("budgetPortalChallenges").doc(input.challengeId);
    const initial = await challengeRef.get();
    if (!initial.exists) return NextResponse.json({ error: "The code is invalid or expired." }, { status: 401 });
    const initialData = initial.data()!;
    const actualVerifier = portalPinVerifier(input.challengeId, input.code);
    if (!portalVerifierMatches(String(initialData.verifier ?? ""), actualVerifier)) {
      await adminDb.runTransaction(async (transaction) => {
        const fresh = await transaction.get(challengeRef);
        if (!fresh.exists || fresh.data()?.status !== "active") return;
        const attempts = Number(fresh.data()?.attempts ?? 0) + 1;
        transaction.update(challengeRef, {
          attempts,
          status: attempts >= Number(fresh.data()?.maximumAttempts ?? 5) ? "locked" : "active",
          updatedAt: Timestamp.now(),
        });
      });
      return NextResponse.json({ error: "The code is invalid or expired." }, { status: 401 });
    }
    const emailKey = String(initialData.emailKey ?? "");
    const viewerUid = `budget_viewer_${emailKey.slice(0, 40)}`;
    const customToken = await createBudgetViewerCustomToken(viewerUid, emailKey);
    const grantsSnapshot = await adminDb.collection("budgetPortalGrants").where("emailKey", "==", emailKey).get();
    const eligibleRefs = grantsSnapshot.docs.filter((document) => document.data().status !== "revoked").map((document) => document.ref);
    if (eligibleRefs.length === 0) return NextResponse.json({ error: "The code is invalid or expired." }, { status: 401 });
    const now = Date.now();
    await adminDb.runTransaction(async (transaction) => {
      const challenge = await transaction.get(challengeRef);
      const data = challenge.data();
      if (!challenge.exists || data?.status !== "active") throw new Error("challenge-unavailable");
      if (Number(data.expiresAt?.toMillis?.() ?? 0) <= now) throw new Error("challenge-unavailable");
      if (Number(data.attempts ?? 0) >= Number(data.maximumAttempts ?? 5)) throw new Error("challenge-unavailable");
      if (!portalVerifierMatches(String(data.verifier ?? ""), actualVerifier)) throw new Error("challenge-unavailable");
      const grantSnapshots = await Promise.all(eligibleRefs.map((reference) => transaction.get(reference)));
      const activeGrantIds: string[] = [];
      grantSnapshots.forEach((grant) => {
        if (!grant.exists || grant.data()?.emailKey !== emailKey || grant.data()?.status === "revoked") return;
        activeGrantIds.push(grant.id);
        transaction.update(grant.ref, {
          status: "active",
          viewerUid,
          lastSuccessfulPortalSignIn: Timestamp.fromMillis(now),
          updatedAt: Timestamp.fromMillis(now),
        });
        transaction.create(adminDb!.collection("budgetPortalAuditEvents").doc(), {
          ownerUid: grant.data()?.ownerUid,
          actorType: "viewer",
          actorUid: viewerUid,
          action: "pin-redeemed",
          grantId: grant.id,
          createdAt: Timestamp.fromMillis(now),
        });
      });
      if (activeGrantIds.length === 0) throw new Error("challenge-unavailable");
      transaction.set(adminDb!.collection("budgetPortalViewerMappings").doc(viewerUid), {
        uid: viewerUid,
        emailKey,
        grantIds: activeGrantIds,
        status: "active",
        updatedAt: Timestamp.fromMillis(now),
      }, { merge: true });
      transaction.update(challengeRef, {
        status: "consumed",
        consumedAt: Timestamp.fromMillis(now),
        viewerUid,
        updatedAt: Timestamp.fromMillis(now),
      });
    });
    return NextResponse.json({ customToken });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : error instanceof Error && error.message === "challenge-unavailable" ? 401 : 503;
    const message = status === 503 ? "Budget sign-in is temporarily unavailable." : "The code is invalid or expired.";
    return NextResponse.json({ error: message }, { status });
  }
}
