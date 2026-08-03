import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";
import { plaidRouteError, requiredString } from "@/lib/plaid-route";
import { requireUid } from "@/lib/requireUid";
import { refreshPlaidBalances } from "@/lib/plaid-sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const uid = await requireUid(request);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const body = (await request.json()) as Record<string, unknown>;
    const plaidItemId = requiredString(body.plaidItemId, "plaidItemId");
    const realtime = body.realtime === true;
    if (realtime && process.env.PLAID_REALTIME_BALANCE_ENABLED !== "true") {
      return NextResponse.json(
        { error: "Real-time balance checks are not enabled for this deployment." },
        { status: 403 },
      );
    }
    const item = await adminDb
      .collection("users")
      .doc(uid)
      .collection("plaidItems")
      .doc(plaidItemId)
      .get();
    if (!item.exists) throw new Error("Bank connection was not found.");
    const last = item.data()?.lastBalanceUpdate;
    if (realtime && typeof last === "string" && Date.now() - Date.parse(last) < 120_000) {
      return NextResponse.json({ cached: true, recordedAt: last });
    }
    return NextResponse.json(
      await refreshPlaidBalances({ uid, plaidItemId, realtime }),
    );
  } catch (error) {
    return plaidRouteError(error);
  }
}
