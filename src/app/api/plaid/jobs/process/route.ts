import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";
import { syncPlaidItem } from "@/lib/plaid-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!adminDb) return NextResponse.json({ error: "Server unavailable." }, { status: 503 });
  const expected = process.env.PLAID_JOB_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const queued = await adminDb
    .collection("plaidWebhookInbox")
    .where("status", "==", "queued")
    .limit(10)
    .get();
  const outcomes: Array<{ id: string; status: string; error?: string }> = [];
  for (const job of queued.docs) {
    const values = job.data();
    const now = new Date().toISOString();
    await job.ref.set(
      {
        status: "running",
        attemptCount: Number(values.attemptCount ?? 0) + 1,
        updatedAt: now,
      },
      { merge: true },
    );
    try {
      await syncPlaidItem({
        uid: String(values.uid),
        plaidItemId: String(values.plaidItemId),
        reason: "webhook",
      });
      await job.ref.set(
        { status: "complete", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { merge: true },
      );
      outcomes.push({ id: job.id, status: "complete" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed.";
      const attempts = Number(values.attemptCount ?? 0) + 1;
      await job.ref.set(
        {
          status: attempts >= 5 ? "failed" : "queued",
          error: message,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      outcomes.push({ id: job.id, status: "failed", error: message });
    }
  }
  if (new URL(request.url).searchParams.get("scheduled") === "1") {
    const owners = await adminDb.collection("plaidItemOwners").limit(25).get();
    for (const owner of owners.docs) {
      const uid = owner.data().uid;
      if (typeof uid !== "string") continue;
      const item = await adminDb
        .collection("users")
        .doc(uid)
        .collection("plaidItems")
        .doc(owner.id)
        .get();
      const lastSync = item.data()?.lastSuccessfulSync;
      if (
        !item.exists ||
        item.data()?.status === "disconnected" ||
        (typeof lastSync === "string" && Date.now() - Date.parse(lastSync) < 6 * 3_600_000)
      ) {
        continue;
      }
      try {
        await syncPlaidItem({ uid, plaidItemId: owner.id, reason: "scheduled" });
        outcomes.push({ id: `scheduled:${owner.id}`, status: "complete" });
      } catch (error) {
        outcomes.push({
          id: `scheduled:${owner.id}`,
          status: "failed",
          error: error instanceof Error ? error.message : "Scheduled sync failed.",
        });
      }
    }
  }
  return NextResponse.json({ processed: outcomes.length, outcomes });
}
