import { NextResponse } from "next/server";

import { AuthenticationError } from "@/lib/auth-token";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireUid } from "@/lib/requireUid";

const CLEARABLE_COLLECTIONS = [
  "transactions",
  "financialSummaries",
  "categories",
  "budgets",
  "recurringTransactions",
  "recurringOccurrences",
  "recurringReconciliationEvents",
  "goals",
  "envelopes",
  "envelopeEvents",
  "accountReconciliations",
  "categorizationRules",
  "categorizationAudit",
  "refundAuditEvents",
  "reports",
  "reportViews",
  "splitTemplates",
  "designatedFunds",
] as const;

async function deleteCollection(reference: FirebaseFirestore.CollectionReference) {
  while (true) {
    const snapshot = await reference.limit(400).get();
    if (snapshot.empty) return;
    const batch = adminDb!.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

export async function POST(request: Request) {
  try {
    const uid = await requireUid(request);
    if (!adminDb) throw new Error("Firestore Admin is not initialized.");
    const user = adminDb.collection("users").doc(uid);

    for (const collectionName of CLEARABLE_COLLECTIONS) {
      await deleteCollection(user.collection(collectionName));
    }

    const accounts = await user.collection("accounts").get();
    for (let index = 0; index < accounts.docs.length; index += 400) {
      const batch = adminDb.batch();
      accounts.docs.slice(index, index + 400).forEach((account) => {
        const data = account.data();
        batch.set(account.ref, {
          role: data.isDefault
            ? "operating"
            : data.type === "credit"
              ? "debt"
              : "standard",
        }, { merge: true });
      });
      await batch.commit();
    }
    return NextResponse.json({ cleared: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof AuthenticationError
          ? "Authentication required."
          : "Ledger data could not be cleared.",
      },
      { status: error instanceof AuthenticationError ? 401 : 500 },
    );
  }
}
