import { NextResponse } from "next/server";

import { plaidRequest } from "@/lib/plaid-client";
import { plaidRouteError } from "@/lib/plaid-route";
import { requireUid } from "@/lib/requireUid";

export const runtime = "nodejs";

interface LinkTokenResponse {
  link_token: string;
  expiration: string;
}

export async function POST(request: Request) {
  try {
    const uid = await requireUid(request);
    const daysRequested = Math.min(
      730,
      Math.max(30, Number(process.env.PLAID_DAYS_REQUESTED) || 730),
    );
    const response = await plaidRequest<LinkTokenResponse>(
      "link/token/create",
      {
        user: { client_user_id: uid },
        client_name: "Ledgerly Pro",
        products: ["transactions"],
        country_codes: (process.env.PLAID_COUNTRY_CODES ?? "US")
          .split(",")
          .map((code) => code.trim().toUpperCase())
          .filter(Boolean),
        language: "en",
        webhook: process.env.PLAID_WEBHOOK_URL,
        redirect_uri: process.env.PLAID_REDIRECT_URI,
        transactions: { days_requested: daysRequested },
      },
    );
    return NextResponse.json({
      linkToken: response.link_token,
      expiration: response.expiration,
    });
  } catch (error) {
    return plaidRouteError(error);
  }
}
