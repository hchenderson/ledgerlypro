import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";
import { AuthenticationError, requireUid } from "@/lib/requireUid";
import { planRecurringOccurrences } from "@/lib/recurring";
import type { RecurringTransaction } from "@/types";

const MAX_OCCURRENCES_PER_REQUEST = 400;

export async function POST(req: Request) {
  try {
    const uid = await requireUid(req);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");

    const userRef = adminDb.collection("users").doc(uid);
    const recurringSnapshot = await userRef.collection("recurringTransactions").get();
    const batch = adminDb.batch();
    let remainingWrites = MAX_OCCURRENCES_PER_REQUEST;
    let upserted = 0;
    let hasMore = false;

    for (const recurringDoc of recurringSnapshot.docs) {
      // Reserve one write for advancing lastAddedDate after the occurrence writes.
      if (remainingWrites <= 1) {
        hasMore = true;
        break;
      }

      const recurring = {
        ...recurringDoc.data(),
        id: recurringDoc.id,
      } as RecurringTransaction;
      const plan = planRecurringOccurrences(
        recurring,
        new Date(),
        remainingWrites - 1
      );

      for (const occurrence of plan.occurrences) {
        const occurrenceRef = userRef.collection("transactions").doc(occurrence.id);
        batch.set(occurrenceRef, occurrence, { merge: true });
      }

      if (plan.lastAddedDate) {
        batch.update(recurringDoc.ref, { lastAddedDate: plan.lastAddedDate });
        remainingWrites -= 1;
      }

      upserted += plan.occurrences.length;
      remainingWrites -= plan.occurrences.length;
      hasMore ||= plan.hasMore;
    }

    if (upserted > 0) await batch.commit();

    return NextResponse.json({ upserted, hasMore });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Recurring transaction processing failed:", error);
    return NextResponse.json(
      { error: "Unable to process recurring transactions." },
      { status: 500 }
    );
  }
}
