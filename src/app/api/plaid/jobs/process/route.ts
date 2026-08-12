import { NextResponse } from "next/server";
import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebaseAdmin";
import { syncPlaidItem } from "@/lib/plaid-sync";
import { logServerEvent, requestLogContext } from "@/lib/server-logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const JOB_LEASE_MS = 5 * 60 * 1000;
const COMPLETE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const FAILED_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

async function claimJob(reference: FirebaseFirestore.DocumentReference) {
  if (!adminDb) return null;
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return null;
    const values = snapshot.data()!;
    const leaseExpiresAt = values.leaseExpiresAt as Timestamp | undefined;
    const claimable =
      values.status === "queued" ||
      (values.status === "running" &&
        leaseExpiresAt instanceof Timestamp &&
        leaseExpiresAt.toMillis() <= Date.now());
    if (!claimable) return null;
    const now = new Date().toISOString();
    transaction.set(
      reference,
      {
        status: "running",
        attemptCount: Number(values.attemptCount ?? 0) + 1,
        leaseExpiresAt: Timestamp.fromMillis(Date.now() + JOB_LEASE_MS),
        expiresAt: FieldValue.delete(),
        updatedAt: now,
      },
      { merge: true },
    );
    return {
      uid: String(values.uid ?? ""),
      plaidItemId: String(values.plaidItemId ?? ""),
      attemptCount: Number(values.attemptCount ?? 0) + 1,
    };
  });
}

async function processWebhookJobs(
  outcomes: Array<{ id: string; status: string; error?: string }>,
) {
  if (!adminDb) return;
  const [queued, running] = await Promise.all([
    adminDb.collection("plaidWebhookInbox").where("status", "==", "queued").limit(10).get(),
    adminDb.collection("plaidWebhookInbox").where("status", "==", "running").limit(20).get(),
  ]);
  const candidates = new Map(
    [...queued.docs, ...running.docs].map((document) => [document.id, document]),
  );
  for (const job of [...candidates.values()].slice(0, 10)) {
    const claimed = await claimJob(job.ref);
    if (!claimed?.uid || !claimed.plaidItemId) continue;
    try {
      await syncPlaidItem({
        uid: claimed.uid,
        plaidItemId: claimed.plaidItemId,
        reason: "webhook",
      });
      const completedAt = new Date().toISOString();
      await job.ref.set(
        {
          status: "complete",
          completedAt,
          updatedAt: completedAt,
          leaseExpiresAt: FieldValue.delete(),
          expiresAt: Timestamp.fromMillis(Date.now() + COMPLETE_RETENTION_MS),
        },
        { merge: true },
      );
      outcomes.push({ id: job.id, status: "complete" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed.";
      const terminal = claimed.attemptCount >= 5;
      await job.ref.set(
        {
          status: terminal ? "failed" : "queued",
          error: message,
          updatedAt: new Date().toISOString(),
          leaseExpiresAt: FieldValue.delete(),
          expiresAt: terminal
            ? Timestamp.fromMillis(Date.now() + FAILED_RETENTION_MS)
            : FieldValue.delete(),
        },
        { merge: true },
      );
      outcomes.push({ id: job.id, status: terminal ? "failed" : "retrying", error: message });
    }
  }
}

async function scheduledOwnerPage() {
  if (!adminDb) return { documents: [], cursorReference: null };
  const cursorReference = adminDb.collection("plaidOperations").doc("scheduledRefresh");
  const cursor = (await cursorReference.get()).data()?.lastOwnerId;
  let query = adminDb
    .collection("plaidItemOwners")
    .orderBy(FieldPath.documentId())
    .limit(25);
  if (typeof cursor === "string" && cursor) query = query.startAfter(cursor);
  let snapshot = await query.get();
  if (snapshot.empty && cursor) {
    snapshot = await adminDb
      .collection("plaidItemOwners")
      .orderBy(FieldPath.documentId())
      .limit(25)
      .get();
  }
  return { documents: snapshot.docs, cursorReference };
}

async function processScheduledItems(
  outcomes: Array<{ id: string; status: string; error?: string }>,
) {
  if (!adminDb) return;
  const { documents: owners, cursorReference } = await scheduledOwnerPage();
  for (let index = 0; index < owners.length; index += 3) {
    await Promise.all(
      owners.slice(index, index + 3).map(async (owner) => {
        const uid = owner.data().uid;
        if (typeof uid !== "string") return;
        const item = await adminDb!
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
        ) return;
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
      }),
    );
  }
  if (cursorReference && !owners.length) return;
  if (cursorReference) {
    await cursorReference.set(
      { lastOwnerId: owners.at(-1)!.id, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }
}

export async function POST(request: Request) {
  const context = requestLogContext(request, "plaid.jobs.process");
  if (!adminDb) return NextResponse.json({ error: "Server unavailable." }, { status: 503 });
  const expected = process.env.PLAID_JOB_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    logServerEvent("warn", "plaid.jobs.unauthorized", context);
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const outcomes: Array<{ id: string; status: string; error?: string }> = [];
    await processWebhookJobs(outcomes);
    if (new URL(request.url).searchParams.get("scheduled") === "1") {
      await processScheduledItems(outcomes);
    }
    logServerEvent("info", "plaid.jobs.complete", {
      ...context,
      processed: outcomes.length,
      failed: outcomes.filter((outcome) => outcome.status === "failed").length,
    });
    return NextResponse.json({ processed: outcomes.length, outcomes });
  } catch (error) {
    logServerEvent("error", "plaid.jobs.failed", context, error);
    return NextResponse.json({ error: "Plaid jobs could not be processed." }, { status: 500 });
  }
}
