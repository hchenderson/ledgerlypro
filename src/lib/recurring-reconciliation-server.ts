import "server-only";

import { createHash } from "node:crypto";

import { adminDb } from "@/lib/firebaseAdmin";
import { withoutUndefined } from "@/lib/firestore-values";
import {
  invalidateRecurringMatch,
  isEligibleRecurringActual,
  refreshRecurringMatch,
} from "@/lib/recurring-reconciliation";
import type {
  RecurringOccurrence,
  RecurringReconciliationEvent,
  Transaction,
} from "@/types";

function eventId(action: string, transaction: Transaction, now: string) {
  return `${action}-${createHash("sha256")
    .update(`${transaction.id}:${now}`)
    .digest("hex")
    .slice(0, 24)}`;
}

export async function synchronizeLinkedRecurringActual({
  uid,
  transaction: actual,
  reason = "linked-actual-became-ineligible",
  now = new Date().toISOString(),
}: {
  uid: string;
  transaction: Transaction;
  reason?: string;
  now?: string;
}) {
  if (!adminDb || !actual.recurringOccurrenceId) return;
  const userRef = adminDb.collection("users").doc(uid);
  const occurrenceRef = userRef
    .collection("recurringOccurrences")
    .doc(actual.recurringOccurrenceId);
  const actualRef = userRef.collection("transactions").doc(actual.id);
  await adminDb.runTransaction(async (transaction) => {
    const occurrenceSnapshot = await transaction.get(occurrenceRef);
    if (!occurrenceSnapshot.exists) return;
    const occurrence = {
      ...occurrenceSnapshot.data(),
      id: occurrenceSnapshot.id,
    } as RecurringOccurrence;
    const eligible = isEligibleRecurringActual(actual);
    const next = eligible
      ? refreshRecurringMatch(occurrence, actual, now)
      : invalidateRecurringMatch(occurrence, actual.id, reason, now);
    if (next === occurrence) return;
    transaction.set(occurrenceRef, withoutUndefined(next));
    transaction.set(actualRef, {
      recurringReconciliationStatus: eligible ? "confirmed" : "exception",
    }, { merge: true });
    if (!eligible) {
      const id = eventId("invalidate", actual, now);
      const audit: RecurringReconciliationEvent = {
        id,
        operationId: id,
        occurrenceId: occurrence.id,
        transactionId: actual.id,
        action: "invalidate",
        createdAt: now,
        details: { reason },
      };
      transaction.set(
        userRef.collection("recurringReconciliationEvents").doc(id),
        audit,
      );
    }
  });
}
