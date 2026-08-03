import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";
import { AuthenticationError, requireUid } from "@/lib/requireUid";
import { planRecurringOccurrences } from "@/lib/recurring";
import type { RecurringTransaction } from "@/types";
import { logServerEvent, requestLogContext } from "@/lib/server-logger";
import { envelopeEventForTransaction } from "@/lib/envelopes";

const MAX_OCCURRENCES_PER_REQUEST = 400;

export async function POST(req: Request) {
  const context = requestLogContext(req, 'recurring.process');
  try {
    const uid = await requireUid(req);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");

    const userRef = adminDb.collection("users").doc(uid);
    const settingsSnapshot = await userRef.collection("settings").doc("main").get();
    const operatingAccountId = settingsSnapshot.data()?.primaryAccountId as
      | string
      | undefined;
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
        Math.floor((remainingWrites - 1) / 2)
      );

      for (const occurrence of plan.occurrences) {
        const occurrenceRef = userRef.collection("transactions").doc(occurrence.id);
        batch.set(occurrenceRef, occurrence, { merge: true });
        remainingWrites -= 1;
        const envelopeEvent = envelopeEventForTransaction(
          occurrence,
          operatingAccountId,
        );
        if (envelopeEvent) {
          batch.set(
            userRef.collection("envelopeEvents").doc(envelopeEvent.id),
            envelopeEvent,
            { merge: true },
          );
          remainingWrites -= 1;
        }
      }

      if (plan.lastAddedDate) {
        batch.update(recurringDoc.ref, { lastAddedDate: plan.lastAddedDate });
        remainingWrites -= 1;
      }

      upserted += plan.occurrences.length;
      hasMore ||= plan.hasMore;
    }

    if (upserted > 0) await batch.commit();

    logServerEvent('info', 'recurring.process.completed', { ...context, uid, upserted, hasMore });
    return NextResponse.json({ upserted, hasMore }, {
      headers: { 'x-request-id': context.requestId },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      logServerEvent('warn', 'recurring.process.unauthorized', context, error);
      return NextResponse.json({ error: error.message }, {
        status: 401,
        headers: { 'x-request-id': context.requestId },
      });
    }
    logServerEvent('error', 'recurring.process.failed', context, error);
    return NextResponse.json(
      { error: "Unable to process recurring transactions." },
      { status: 500, headers: { 'x-request-id': context.requestId } }
    );
  }
}
