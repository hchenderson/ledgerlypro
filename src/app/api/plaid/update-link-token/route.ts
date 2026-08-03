import { NextResponse } from "next/server";

import { plaidRequest } from "@/lib/plaid-client";
import { plaidRouteError, requiredString } from "@/lib/plaid-route";
import { requireUid } from "@/lib/requireUid";
import { getPlaidAccessToken } from "@/lib/plaid-sync";

export const runtime = "nodejs";

interface LinkTokenResponse {
  link_token: string;
  expiration: string;
}

export async function POST(request: Request) {
  try {
    const uid = await requireUid(request);
    const body = (await request.json()) as Record<string, unknown>;
    const plaidItemId = requiredString(body.plaidItemId, "plaidItemId");
    const accessToken = await getPlaidAccessToken(uid, plaidItemId);
    const response = await plaidRequest<LinkTokenResponse>("link/token/create", {
      user: { client_user_id: uid },
      client_name: "Ledgerly Pro",
      access_token: accessToken,
      country_codes: (process.env.PLAID_COUNTRY_CODES ?? "US")
        .split(",")
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean),
      language: "en",
      webhook: process.env.PLAID_WEBHOOK_URL,
      redirect_uri: process.env.PLAID_REDIRECT_URI,
    });
    return NextResponse.json({
      linkToken: response.link_token,
      expiration: response.expiration,
    });
  } catch (error) {
    return plaidRouteError(error);
  }
}
