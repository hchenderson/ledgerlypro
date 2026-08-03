import { NextResponse } from "next/server";

import { plaidRouteError, requiredString } from "@/lib/plaid-route";
import { requireUid } from "@/lib/requireUid";
import { syncPlaidItem } from "@/lib/plaid-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const uid = await requireUid(request);
    const body = (await request.json()) as Record<string, unknown>;
    const plaidItemId = requiredString(body.plaidItemId, "plaidItemId");
    const result = await syncPlaidItem({ uid, plaidItemId, reason: "manual" });
    return NextResponse.json(result);
  } catch (error) {
    return plaidRouteError(error);
  }
}
