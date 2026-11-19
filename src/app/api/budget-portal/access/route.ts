import { createHash } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizePortalEmail, portalEmailKey } from "@/lib/budget-portal-crypto";
import { portalInvitationEmail } from "@/lib/budget-portal-email";
import { buildBudgetPortalSummary, portalTimestampIso } from "@/lib/budget-portal-summary";
import type { BudgetPortalGrant } from "@/lib/budget-portal-types";
import { adminDb } from "@/lib/firebaseAdmin";
import { assertLedgerDate } from "@/lib/ledger-date";
import { AuthenticationError, requireUid } from "@/lib/requireUid";

const grantInput = z.object({
  email: z.string().email().max(320),
  displayName: z.string().trim().max(120).nullable().optional(),
  budgetIds: z.array(z.string().min(1).max(200)).min(1).max(100),
});
const updateInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), grantId: z.string().min(1), displayName: z.string().trim().max(120).nullable().optional(), budgetIds: z.array(z.string().min(1).max(200)).min(1).max(100) }),
  z.object({ action: z.literal("revoke"), grantId: z.string().min(1) }),
  z.object({ action: z.literal("reviewed-through"), reviewedThrough: z.string().nullable() }),
  z.object({ action: z.literal("preview"), budgetIds: z.array(z.string().min(1).max(200)).min(1).max(100) }),
]);

function grantResponse(document: FirebaseFirestore.QueryDocumentSnapshot): BudgetPortalGrant {
  const data = document.data();
  return {
    id: document.id,
    email: String(data.email ?? ""),
    displayName: typeof data.displayName === "string" ? data.displayName : null,
    budgetIds: Array.isArray(data.budgetIds) ? data.budgetIds.filter((value): value is string => typeof value === "string") : [],
    status: ["pending", "active", "revoked"].includes(data.status) ? data.status : "pending",
    createdAt: portalTimestampIso(data.createdAt),
    updatedAt: portalTimestampIso(data.updatedAt),
    lastSuccessfulPortalSignIn: portalTimestampIso(data.lastSuccessfulPortalSignIn),
  };
}

async function assertBudgetsBelongToOwner(uid: string, budgetIds: string[]) {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
  const unique = [...new Set(budgetIds)];
  const snapshots = await Promise.all(unique.map((id) => adminDb!.collection("users").doc(uid).collection("budgets").doc(id).get()));
  if (snapshots.some((snapshot) => !snapshot.exists)) throw new Error("One or more selected budgets no longer exist.");
  return unique;
}

export async function GET(request: Request) {
  try {
    const uid = await requireUid(request);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const [grants, settings] = await Promise.all([
      adminDb.collection("budgetPortalGrants").where("ownerUid", "==", uid).get(),
      adminDb.collection("budgetPortalSettings").doc(uid).get(),
    ]);
    return NextResponse.json({
      grants: grants.docs.map(grantResponse).sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")),
      reviewedThrough: typeof settings.data()?.reviewedThrough === "string" ? settings.data()?.reviewedThrough : null,
      reviewedThroughScope: "ledger",
    });
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Sign in as a Ledgerly owner." : "Budget access could not be loaded." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const uid = await requireUid(request);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const input = grantInput.parse(await request.json());
    const email = normalizePortalEmail(input.email);
    const budgetIds = await assertBudgetsBelongToOwner(uid, input.budgetIds);
    const emailKey = portalEmailKey(email);
    const grantId = createHash("sha256").update(`${uid}:${emailKey}`).digest("hex");
    const ref = adminDb.collection("budgetPortalGrants").doc(grantId);
    const existing = await ref.get();
    const now = Timestamp.now();
    await adminDb.runTransaction(async (transaction) => {
      transaction.set(ref, {
        ownerUid: uid,
        email,
        emailKey,
        displayName: input.displayName || null,
        budgetIds,
        status: existing.data()?.viewerUid ? "active" : "pending",
        viewerUid: existing.data()?.viewerUid ?? null,
        createdAt: existing.data()?.createdAt ?? now,
        updatedAt: now,
      });
      transaction.create(adminDb!.collection("budgetPortalAuditEvents").doc(), {
        ownerUid: uid,
        actorType: "owner",
        actorUid: uid,
        action: existing.exists ? "grant-updated" : "grant-created",
        grantId,
        budgetIds,
        createdAt: now,
      });
    });
    let invitationDelivery: "sent" | "failed" = "sent";
    try {
      await portalInvitationEmail(email, input.displayName || null, `invite-${grantId}-${now.toMillis()}`);
    } catch {
      invitationDelivery = "failed";
    }
    return NextResponse.json({ grant: grantResponse(await ref.get() as FirebaseFirestore.QueryDocumentSnapshot), invitationDelivery });
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : error instanceof z.ZodError ? 400 : 409;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Budget access could not be saved." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const uid = await requireUid(request);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const input = updateInput.parse(await request.json());
    if (input.action === "reviewed-through") {
      if (input.reviewedThrough) assertLedgerDate(input.reviewedThrough);
      await adminDb.collection("budgetPortalSettings").doc(uid).set({
        ownerUid: uid,
        reviewedThrough: input.reviewedThrough ?? FieldValue.delete(),
        updatedAt: Timestamp.now(),
      }, { merge: true });
      await adminDb.collection("budgetPortalAuditEvents").add({ ownerUid: uid, actorType: "owner", actorUid: uid, action: "reviewed-through-updated", reviewedThrough: input.reviewedThrough, createdAt: Timestamp.now() });
      return NextResponse.json({ ok: true });
    }
    if (input.action === "preview") {
      const budgetIds = await assertBudgetsBelongToOwner(uid, input.budgetIds);
      return NextResponse.json(await buildBudgetPortalSummary({ ownerUid: uid, budgetIds, displayName: "Preview" }));
    }
    const ref = adminDb.collection("budgetPortalGrants").doc(input.grantId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.ownerUid !== uid) throw new Error("Budget access record was not found.");
    const now = Timestamp.now();
    if (input.action === "revoke") {
      await adminDb.runTransaction(async (transaction) => {
        const fresh = await transaction.get(ref);
        if (!fresh.exists || fresh.data()?.ownerUid !== uid) throw new Error("Budget access record was not found.");
        transaction.update(ref, { status: "revoked", revokedAt: now, updatedAt: now });
        transaction.create(adminDb!.collection("budgetPortalAuditEvents").doc(), { ownerUid: uid, actorType: "owner", actorUid: uid, action: "grant-revoked", grantId: input.grantId, createdAt: now });
      });
      return NextResponse.json({ ok: true });
    }
    const budgetIds = await assertBudgetsBelongToOwner(uid, input.budgetIds);
    await adminDb.runTransaction(async (transaction) => {
      const fresh = await transaction.get(ref);
      if (!fresh.exists || fresh.data()?.ownerUid !== uid) throw new Error("Budget access record was not found.");
      transaction.update(ref, { budgetIds, displayName: input.displayName || null, updatedAt: now });
      transaction.create(adminDb!.collection("budgetPortalAuditEvents").doc(), { ownerUid: uid, actorType: "owner", actorUid: uid, action: "grant-updated", grantId: input.grantId, budgetIds, createdAt: now });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : error instanceof z.ZodError ? 400 : 409;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Budget access could not be updated." }, { status });
  }
}
