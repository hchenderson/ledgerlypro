import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebaseAdmin";
import { withoutUndefined } from "@/lib/firestore-values";
import { buildRefundLink } from "@/lib/refunds";
import { AuthenticationError, requireUid } from "@/lib/requireUid";
import type { Transaction } from "@/types";

const allocationSchema = z.object({
  id: z.string().min(1),
  amount: z.number().positive(),
  amountMinor: z.number().int().positive().optional(),
  category: z.string().min(1),
  categoryId: z.string().min(1),
  envelopeId: z.string().nullable().optional(),
});
const requestSchema = z.object({
  refundTransactionId: z.string().min(1),
  originalTransactionId: z.string().min(1),
  allocations: z.array(allocationSchema).optional(),
});

export async function POST(request: Request) {
  try {
    const uid = await requireUid(request);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const database = adminDb;
    const input = requestSchema.parse(await request.json());
    const transactions = database.collection("users").doc(uid).collection("transactions");
    const refundRef = transactions.doc(input.refundTransactionId);
    const originalRef = transactions.doc(input.originalTransactionId);
    await database.runTransaction(async (transaction) => {
      const [refundSnapshot, originalSnapshot, existingSnapshot] = await Promise.all([
        transaction.get(refundRef),
        transaction.get(originalRef),
        transaction.get(transactions.where("refundOfTransactionId", "==", input.originalTransactionId)),
      ]);
      if (!refundSnapshot.exists || !originalSnapshot.exists) throw new Error("Refund or original purchase was not found.");
      const refund = { ...refundSnapshot.data(), id: refundSnapshot.id } as Transaction;
      const original = { ...originalSnapshot.data(), id: originalSnapshot.id } as Transaction;
      const existingRefunds = existingSnapshot.docs.map((document) => ({ ...document.data(), id: document.id }) as Transaction);
      const linked = buildRefundLink({ refund, original, existingRefunds, allocations: input.allocations });
      transaction.set(refundRef, {
        ...withoutUndefined(linked),
        ...(linked.categoryId === undefined ? { categoryId: FieldValue.delete() } : {}),
        ...(linked.envelopeId === undefined ? { envelopeId: FieldValue.delete() } : {}),
        ...(linked.allocations === undefined ? { allocations: FieldValue.delete() } : {}),
      }, { merge: true });
      const auditRef = database.collection("users").doc(uid).collection("refundAuditEvents").doc();
      transaction.create(auditRef, {
        type: "refund-linked",
        refundTransactionId: refund.id,
        originalTransactionId: original.id,
        amountMinor: linked.amountMinor,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : error instanceof z.ZodError ? 400 : 409;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Refund could not be linked." }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const uid = await requireUid(request);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const database = adminDb;
    const { refundTransactionId } = requestSchema.pick({ refundTransactionId: true }).parse(await request.json());
    const refundRef = database.collection("users").doc(uid).collection("transactions").doc(refundTransactionId);
    await database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(refundRef);
      if (!snapshot.exists) throw new Error("Refund was not found.");
      const originalTransactionId = snapshot.data()?.refundOfTransactionId;
      transaction.set(refundRef, {
        refundOfTransactionId: FieldValue.delete(),
        refundStatus: FieldValue.delete(),
        categorizationStatus: "needs-review",
      }, { merge: true });
      const auditRef = database.collection("users").doc(uid).collection("refundAuditEvents").doc();
      transaction.create(auditRef, {
        type: "refund-unlinked",
        refundTransactionId,
        originalTransactionId: originalTransactionId ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : error instanceof z.ZodError ? 400 : 409;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Refund could not be unlinked." }, { status });
  }
}
