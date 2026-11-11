import { NextResponse } from "next/server";
import { addDays, startOfDay } from "date-fns";

import { adminDb } from "@/lib/firebaseAdmin";
import { AuthenticationError, requireUid } from "@/lib/requireUid";
import { planRecurringOccurrences } from "@/lib/recurring";
import type { RecurringTransaction } from "@/types";
import { logServerEvent, requestLogContext } from "@/lib/server-logger";

const MAX_OCCURRENCES_PER_REQUEST = 400;

export async function POST(req: Request) {
  const context = requestLogContext(req, 'recurring.process');
  try {
    const uid = await requireUid(req);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");

    const userRef = adminDb.collection("users").doc(uid);
    const recurringSnapshot = await userRef.collection("recurringTransactions").get();
    let upserted = 0;
    let hasMore = false;
    const throughDate = addDays(startOfDay(new Date()), 89);

    for (const recurringDoc of recurringSnapshot.docs) {
      const result = await adminDb.runTransaction(async (transaction) => {
        const currentScheduleSnapshot = await transaction.get(recurringDoc.ref);
        if (!currentScheduleSnapshot.exists) return { created: 0, hasMore: false };
        const recurring = {
          ...currentScheduleSnapshot.data(),
          id: recurringDoc.id,
        } as RecurringTransaction;
        const plan = planRecurringOccurrences(
          recurring,
          throughDate,
          MAX_OCCURRENCES_PER_REQUEST - 1,
        );
        const occurrenceRefs = plan.occurrences.map((occurrence) =>
          userRef.collection("recurringOccurrences").doc(occurrence.id),
        );
        const existing = occurrenceRefs.length > 0
          ? await transaction.getAll(...occurrenceRefs)
          : [];
        let created = 0;
        plan.occurrences.forEach((occurrence, index) => {
          // Never merge schedule edits into an existing occurrence. Its due
          // identity and snapshot survive edits, deletion, matches, and retries.
          if (existing[index]?.exists) return;
          transaction.create(occurrenceRefs[index], occurrence);
          created += 1;
        });
        if (plan.lastAddedDate) {
          transaction.update(recurringDoc.ref, {
            lastAddedDate: plan.lastAddedDate,
          });
        }
        return { created, hasMore: plan.hasMore };
      });
      upserted += result.created;
      hasMore ||= result.hasMore;
    }

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
