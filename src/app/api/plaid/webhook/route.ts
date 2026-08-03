import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";
import { verifyPlaidWebhook } from "@/lib/plaid-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!adminDb) {
    return NextResponse.json({ error: "Server unavailable." }, { status: 503 });
  }
  const rawBody = await request.text();
  const verified = await verifyPlaidWebhook(
    rawBody,
    request.headers.get("plaid-verification"),
  ).catch((error) => {
    console.error("Plaid webhook verification failed:", error);
    return false;
  });
  if (!verified) return NextResponse.json({ error: "Invalid webhook." }, { status: 401 });

  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  const plaidItemId =
    typeof payload.item_id === "string" ? payload.item_id : undefined;
  if (!plaidItemId) return NextResponse.json({ received: true });
  const owner = await adminDb.collection("plaidItemOwners").doc(plaidItemId).get();
  if (!owner.exists || typeof owner.data()?.uid !== "string") {
    return NextResponse.json({ received: true });
  }
  const now = new Date().toISOString();
  const webhookCode =
    typeof payload.webhook_code === "string" ? payload.webhook_code : "";
  const immediateStatus =
    webhookCode === "PENDING_EXPIRATION"
      ? "permission-expiring"
      : webhookCode === "ERROR"
        ? "needs-attention"
        : undefined;
  const id = createHash("sha256").update(rawBody).digest("hex");
  await adminDb.collection("plaidWebhookInbox").doc(id).set(
    {
      id,
      uid: owner.data()!.uid,
      plaidItemId,
      webhookType: payload.webhook_type ?? null,
      webhookCode: webhookCode || null,
      status: "queued",
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );
  await adminDb
    .collection("users")
    .doc(owner.data()!.uid)
    .collection("plaidItems")
    .doc(plaidItemId)
    .set(
      {
        lastWebhookAt: now,
        updatedAt: now,
        ...(immediateStatus ? { status: immediateStatus } : {}),
      },
      { merge: true },
    );
  return NextResponse.json({ received: true });
}
