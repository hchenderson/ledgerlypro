import { NextResponse } from "next/server";

import {
  getCashFlowProjections,
  GetCashFlowProjectionsInputSchema,
} from "@/ai/flows/cash-flow-projections";
import { AuthenticationError, requireUid } from "@/lib/requireUid";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const uid = await requireUid(req);
    const rateLimit = checkRateLimit({
      key: `projection:${uid}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many projection requests. Please wait and try again." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = GetCashFlowProjectionsInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid projection request." }, { status: 400 });
    }

    return NextResponse.json(await getCashFlowProjections(parsed.data));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Projection generation failed:", error);
    return NextResponse.json({ error: "Unable to generate a projection." }, { status: 500 });
  }
}
