import { addDays, endOfDay, startOfDay } from "date-fns";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebaseAdmin";
import { withoutUndefined } from "@/lib/firestore-values";
import {
  buildRecurringMatchCandidates,
  confirmRecurringMatch,
  dismissRecurringCandidate,
  skipRecurringOccurrence,
  undoDismissRecurringCandidate,
  unlinkRecurringMatch,
} from "@/lib/recurring-reconciliation";
import { recurringOccurrenceFromLegacyTransaction } from "@/lib/recurring";
import { AuthenticationError, requireUid } from "@/lib/requireUid";
import { logServerEvent, requestLogContext } from "@/lib/server-logger";
import type {
  RecurringOccurrence,
  RecurringReconciliationEvent,
  Transaction,
} from "@/types";

const ActionSchema = z.object({
  action: z.enum(["confirm", "unlink", "dismiss", "undo-dismiss", "skip"]),
  occurrenceId: z.string().trim().min(1).max(200),
  transactionId: z.string().trim().min(1).max(200).optional(),
  legacyTransactionId: z.string().trim().min(1).max(200).optional(),
  operationId: z.string().trim().min(8).max(100),
});

function errorResponse(error: unknown, requestId: string) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { error: error.message },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }
  const message = error instanceof Error ? error.message : "Recurring reconciliation failed.";
  const status = /not found/i.test(message) ? 404 : 409;
  return NextResponse.json(
    { error: message },
    { status, headers: { "x-request-id": requestId } },
  );
}

export async function GET(req: Request) {
  const context = requestLogContext(req, "recurring.reconcile.list");
  try {
    const uid = await requireUid(req);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const userRef = adminDb.collection("users").doc(uid);
    const from = startOfDay(addDays(new Date(), -35)).toISOString();
    const to = endOfDay(addDays(new Date(), 97)).toISOString();
    const [occurrenceSnapshot, transactionSnapshot, settingsSnapshot] =
      await Promise.all([
        userRef
          .collection("recurringOccurrences")
          .where("originalDueDate", ">=", from)
          .where("originalDueDate", "<=", to)
          .get(),
        userRef
          .collection("transactions")
          .where("date", ">=", from)
          .where("date", "<=", to)
          .get(),
        userRef.collection("settings").doc("main").get(),
      ]);
    const occurrences = occurrenceSnapshot.docs.map(
      (document) => ({ ...document.data(), id: document.id }) as RecurringOccurrence,
    );
    const transactions = transactionSnapshot.docs.map(
      (document) => ({ ...document.data(), id: document.id }) as Transaction,
    );
    const byOccurrenceId = new Map(
      occurrences.map((occurrence) => [occurrence.id, occurrence]),
    );
    const legacyExplicit = transactions
      .map((transaction) => recurringOccurrenceFromLegacyTransaction(transaction))
      .filter((occurrence): occurrence is RecurringOccurrence => Boolean(occurrence));
    for (const occurrence of legacyExplicit) {
      if (!byOccurrenceId.has(occurrence.id)) {
        byOccurrenceId.set(occurrence.id, occurrence);
      }
    }
    const reviewOccurrences = [...byOccurrenceId.values()];
    const primaryAccountId = settingsSnapshot.data()?.primaryAccountId as
      | string
      | undefined;
    const candidates = buildRecurringMatchCandidates(
      reviewOccurrences,
      transactions,
      { primaryAccountId },
    );
    const candidateTransactionIds = new Set(
      candidates.map((candidate) => candidate.transactionId),
    );
    reviewOccurrences.forEach((occurrence) =>
      occurrence.matches.forEach((match) =>
        candidateTransactionIds.add(match.transactionId),
      ),
    );
    const safeTransactions = transactions
      .filter((transaction) => candidateTransactionIds.has(transaction.id))
      .map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        merchantName: transaction.merchantName,
        accountId: transaction.accountId,
        postingStatus: transaction.postingStatus,
        providerRemovedAt: transaction.providerRemovedAt,
        recurringOccurrenceId: transaction.recurringOccurrenceId,
      }));
    const legacyNeedsReview = transactions
      .filter(
        (transaction) =>
          transaction.source !== "recurring" &&
          !transaction.recurringTransactionId &&
          transaction.description.startsWith("(Recurring)"),
      )
      .map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
      }));

    return NextResponse.json({
      occurrences: reviewOccurrences,
      candidates,
      transactions: safeTransactions,
      migration: {
        persistedOccurrences: occurrenceSnapshot.size,
        compatibleLegacyOccurrences: legacyExplicit.filter(
          (occurrence) => !occurrenceSnapshot.docs.some(
            (document) => document.id === occurrence.id,
          ),
        ).length,
        prefixOnlyRecordsRequiringReview: legacyNeedsReview,
      },
    }, { headers: { "x-request-id": context.requestId } });
  } catch (error) {
    logServerEvent("error", "recurring.reconcile.list_failed", context, error);
    return errorResponse(error, context.requestId);
  }
}

export async function POST(req: Request) {
  const context = requestLogContext(req, "recurring.reconcile.action");
  try {
    const uid = await requireUid(req);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid reconciliation action." },
        { status: 400, headers: { "x-request-id": context.requestId } },
      );
    }
    const input = parsed.data;
    if (input.action !== "skip" && !input.transactionId) {
      return NextResponse.json(
        { error: "A transaction is required for this action." },
        { status: 400, headers: { "x-request-id": context.requestId } },
      );
    }
    const userRef = adminDb.collection("users").doc(uid);
    const occurrenceRef = userRef
      .collection("recurringOccurrences")
      .doc(input.occurrenceId);
    const transactionRef = input.transactionId
      ? userRef.collection("transactions").doc(input.transactionId)
      : null;
    const auditRef = userRef
      .collection("recurringReconciliationEvents")
      .doc(input.operationId);
    const now = new Date().toISOString();

    const result = await adminDb.runTransaction(async (transaction) => {
      const auditSnapshot = await transaction.get(auditRef);
      if (auditSnapshot.exists) {
        const audit = auditSnapshot.data() as RecurringReconciliationEvent;
        if (
          audit.occurrenceId !== input.occurrenceId ||
          audit.action !== input.action ||
          (audit.transactionId ?? null) !== (input.transactionId ?? null)
        ) {
          throw new Error("That reconciliation operation ID was already used.");
        }
        const existingOccurrence = await transaction.get(occurrenceRef);
        return {
          occurrence: existingOccurrence.exists
            ? ({ ...existingOccurrence.data(), id: existingOccurrence.id } as RecurringOccurrence)
            : null,
          idempotent: true,
        };
      }

      const occurrenceSnapshot = await transaction.get(occurrenceRef);
      let occurrence = occurrenceSnapshot.exists
        ? ({ ...occurrenceSnapshot.data(), id: occurrenceSnapshot.id } as RecurringOccurrence)
        : null;
      if (!occurrence) {
        const legacyTransactionId = input.legacyTransactionId ?? input.occurrenceId;
        const legacySnapshot = await transaction.get(
          userRef.collection("transactions").doc(legacyTransactionId),
        );
        if (legacySnapshot.exists) {
          const compatibleOccurrence = recurringOccurrenceFromLegacyTransaction({
            ...legacySnapshot.data(),
            id: legacySnapshot.id,
          } as Transaction, now);
          if (compatibleOccurrence?.id === input.occurrenceId) {
            occurrence = compatibleOccurrence;
          }
        }
      }
      if (!occurrence) throw new Error("Recurring occurrence was not found.");

      const actualSnapshot = transactionRef
        ? await transaction.get(transactionRef)
        : null;
      const actual = actualSnapshot?.exists
        ? ({ ...actualSnapshot.data(), id: actualSnapshot.id } as Transaction)
        : null;
      let nextOccurrence = occurrence;
      if (input.action === "confirm") {
        if (!actual) throw new Error("Candidate transaction was not found.");
        const settingsSnapshot = await transaction.get(
          userRef.collection("settings").doc("main"),
        );
        const candidates = buildRecurringMatchCandidates(
          [occurrence],
          [actual],
          { primaryAccountId: settingsSnapshot.data()?.primaryAccountId as string | undefined },
        );
        if (candidates.length === 0) {
          throw new Error("This transaction is no longer an eligible match.");
        }
        nextOccurrence = confirmRecurringMatch(occurrence, actual, now);
        transaction.set(transactionRef!, {
          recurringOccurrenceId: occurrence.id,
          recurringOriginalDueDate: occurrence.originalDueDate,
          recurringExpectedAmount: occurrence.expectedAmount,
          recurringReconciliationStatus: "confirmed",
        }, { merge: true });
        if (occurrence.legacyTransactionId) {
          transaction.set(
            userRef.collection("transactions").doc(occurrence.legacyTransactionId),
            {
              recurringExpectationOnly: true,
              recurringOccurrenceId: occurrence.id,
            },
            { merge: true },
          );
        }
      } else if (input.action === "unlink") {
        nextOccurrence = unlinkRecurringMatch(
          occurrence,
          input.transactionId!,
          now,
        );
        if (actualSnapshot?.exists) {
          transaction.update(transactionRef!, {
            recurringOccurrenceId: FieldValue.delete(),
            recurringOriginalDueDate: FieldValue.delete(),
            recurringExpectedAmount: FieldValue.delete(),
            recurringReconciliationStatus: FieldValue.delete(),
          });
        }
      } else if (input.action === "dismiss") {
        if (!actual) throw new Error("Candidate transaction was not found.");
        nextOccurrence = dismissRecurringCandidate(
          occurrence,
          input.transactionId!,
          now,
        );
      } else if (input.action === "undo-dismiss") {
        nextOccurrence = undoDismissRecurringCandidate(
          occurrence,
          input.transactionId!,
          now,
        );
      } else if (input.action === "skip") {
        nextOccurrence = skipRecurringOccurrence(occurrence, now);
      }

      transaction.set(occurrenceRef, withoutUndefined(nextOccurrence));
      const event: RecurringReconciliationEvent = {
        id: input.operationId,
        operationId: input.operationId,
        occurrenceId: occurrence.id,
        ...(input.transactionId ? { transactionId: input.transactionId } : {}),
        action: input.action,
        createdAt: now,
        details: {
          previousStatus: occurrence.status,
          nextStatus: nextOccurrence.status,
          expectedAmount: occurrence.expectedAmount,
          remainingAmount: nextOccurrence.remainingAmount,
        },
      };
      transaction.create(auditRef, event);
      return { occurrence: nextOccurrence, idempotent: false };
    });

    logServerEvent("info", "recurring.reconcile.completed", {
      ...context,
      uid,
      action: input.action,
      occurrenceId: input.occurrenceId,
      idempotent: result.idempotent,
    });
    return NextResponse.json(result, {
      headers: { "x-request-id": context.requestId },
    });
  } catch (error) {
    logServerEvent("warn", "recurring.reconcile.failed", context, error);
    return errorResponse(error, context.requestId);
  }
}
