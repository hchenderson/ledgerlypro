import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";
import {
  PlaidEnvironmentMismatchError,
  plaidConfigurationStatus,
  plaidRequest,
} from "@/lib/plaid-client";
import { plaidRouteError, requiredString } from "@/lib/plaid-route";
import { requireUid } from "@/lib/requireUid";
import {
  getPlaidAccessToken,
  removePlaidItemData,
} from "@/lib/plaid-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const uid = await requireUid(request);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const body = (await request.json()) as Record<string, unknown>;
    const plaidItemId = requiredString(body.plaidItemId, "plaidItemId");
    const deleteImportedData = body.deleteImportedData === true;
    let providerRevoked = false;
    try {
      const accessToken = await getPlaidAccessToken(uid, plaidItemId);
      await plaidRequest("item/remove", { access_token: accessToken });
      providerRevoked = true;
    } catch (error) {
      // Tokens cannot cross Plaid environments. An old Sandbox connection can
      // still be removed locally after the app moves to Production.
      if (!(error instanceof PlaidEnvironmentMismatchError)) throw error;
    }
    const result = deleteImportedData
      ? await removePlaidItemData({ uid, plaidItemId })
      : { deletedTransactions: 0, unlinkedAccounts: 0 };
    const now = new Date().toISOString();
    const batch = adminDb.batch();
    batch.delete(
      adminDb
        .collection("plaidSecrets")
        .doc(uid)
        .collection("items")
        .doc(plaidItemId),
    );
    batch.delete(adminDb.collection("plaidItemOwners").doc(plaidItemId));
    batch.set(
      adminDb
        .collection("users")
        .doc(uid)
        .collection("plaidItems")
        .doc(plaidItemId),
      {
        status: "disconnected",
        environment: plaidConfigurationStatus().environment,
        availableAccounts: [],
        disconnectedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    await batch.commit();
    return NextResponse.json({
      disconnected: true,
      providerRevoked,
      ...result,
    });
  } catch (error) {
    return plaidRouteError(error);
  }
}
