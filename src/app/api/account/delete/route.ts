import { NextResponse } from "next/server";

import { AuthenticationError } from "@/lib/auth-token";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { PlaidEnvironmentMismatchError, plaidRequest } from "@/lib/plaid-client";
import { getPlaidAccessToken } from "@/lib/plaid-sync";
import { requireRecentUid } from "@/lib/requireUid";
import { logServerEvent, requestLogContext } from "@/lib/server-logger";

export const runtime = "nodejs";
export const maxDuration = 300;

async function deleteQueryDocuments(
  query: FirebaseFirestore.Query,
) {
  while (true) {
    const snapshot = await query.limit(400).get();
    if (snapshot.empty) return;
    const batch = adminDb!.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

export async function POST(request: Request) {
  const context = requestLogContext(request, "account.delete");
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: "Server unavailable." }, { status: 503 });
    }
    const uid = await requireRecentUid(request);
    const secretItems = await adminDb
      .collection("plaidSecrets")
      .doc(uid)
      .collection("items")
      .get();

    for (const item of secretItems.docs) {
      try {
        const accessToken = await getPlaidAccessToken(uid, item.id);
        await plaidRequest("item/remove", { access_token: accessToken });
      } catch (error) {
        // Account deletion must still remove Ledgerly's copy if Plaid is
        // unavailable or the connection belongs to an older environment.
        logServerEvent(
          error instanceof PlaidEnvironmentMismatchError ? "info" : "warn",
          "account.delete.plaid_revoke_skipped",
          { ...context, uid, plaidItemId: item.id },
          error,
        );
      }
    }

    await adminDb.recursiveDelete(adminDb.collection("users").doc(uid));
    await adminDb.recursiveDelete(adminDb.collection("plaidSecrets").doc(uid));
    await Promise.all([
      deleteQueryDocuments(adminDb.collection("plaidItemOwners").where("uid", "==", uid)),
      deleteQueryDocuments(adminDb.collection("plaidWebhookInbox").where("uid", "==", uid)),
    ]);
    await adminAuth.deleteUser(uid);
    logServerEvent("info", "account.delete.complete", { ...context, uid });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    logServerEvent("error", "account.delete.failed", context, error);
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Your account could not be completely deleted. Please try again or contact support." },
      { status: 500 },
    );
  }
}
