import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";
import { withoutUndefined } from "@/lib/firestore-values";
import { categorizeTransaction, isTransactionReviewable } from "@/lib/categorization";
import { envelopeEventForTransaction } from "@/lib/envelopes";
import { rebuildServerAggregates } from "@/lib/plaid-sync";
import { plaidRouteError } from "@/lib/plaid-route";
import { requireUid } from "@/lib/requireUid";
import type { CategorizationRule, Transaction } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const uid = await requireUid(request);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const user = adminDb.collection("users").doc(uid);
    const [rulesSnapshot, transactionsSnapshot, settingsSnapshot] = await Promise.all([
      user.collection("categorizationRules").where("enabled", "==", true).get(),
      user.collection("transactions").get(),
      user.collection("settings").doc("main").get(),
    ]);
    const rules = rulesSnapshot.docs.map((document) => ({ ...document.data(), id: document.id }) as CategorizationRule);
    const primaryAccountId = settingsSnapshot.data()?.primaryAccountId as string | undefined;
    const updates: Array<{ transaction: Transaction; document: (typeof transactionsSnapshot.docs)[number] }> = [];
    for (const document of transactionsSnapshot.docs) {
      const transaction = { ...document.data(), id: document.id } as Transaction;
      if (!isTransactionReviewable(transaction) || transaction.classificationLocked || transaction.type === "transfer") continue;
      const result = categorizeTransaction(transaction, rules);
      if (result.source !== "rule") continue;
      updates.push({
        document,
        transaction: {
          ...transaction,
          category: result.categoryName,
          categoryId: result.categoryId,
          envelopeId: result.envelopeId,
          categorizationStatus: result.status,
          categorizationSource: result.source,
          categorizationRuleId: result.ruleId,
          categorizedAt: new Date().toISOString(),
          reviewedAt: result.reviewed ? new Date().toISOString() : transaction.reviewedAt,
        },
      });
    }
    const affectedYears = new Set<number>();
    for (let index = 0; index < updates.length; index += 200) {
      const batch = adminDb.batch();
      updates.slice(index, index + 200).forEach(({ transaction, document }) => {
        batch.set(document.ref, withoutUndefined(transaction), { merge: true });
        const event = envelopeEventForTransaction(transaction, primaryAccountId);
        const eventRef = user.collection("envelopeEvents").doc(`transaction-${transaction.id}`);
        if (event) batch.set(eventRef, event, { merge: true });
        else batch.delete(eventRef);
        const year = new Date(transaction.date).getFullYear();
        if (Number.isFinite(year)) affectedYears.add(year);
      });
      await batch.commit();
    }
    if (affectedYears.size > 0) await rebuildServerAggregates(uid, affectedYears);
    const now = new Date().toISOString();
    await user.collection("categorizationAudit").doc(`bulk-${Date.now()}`).set({
      type: "bulk-applied",
      matchedCount: updates.length,
      createdAt: now,
    });
    return NextResponse.json({ updated: updates.length });
  } catch (error) {
    return plaidRouteError(error);
  }
}
