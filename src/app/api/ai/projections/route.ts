import { NextResponse } from "next/server";

import {
  getCashFlowProjections,
  GetCashFlowProjectionsInputSchema,
} from "@/ai/flows/cash-flow-projections";
import { AuthenticationError, requireUid } from "@/lib/requireUid";
import { checkRateLimit } from "@/lib/rate-limit";
import { logServerEvent, requestLogContext } from "@/lib/server-logger";

export async function POST(req: Request) {
  const context = requestLogContext(req, 'ai.projection');
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
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
            'x-request-id': context.requestId,
          },
        }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = GetCashFlowProjectionsInputSchema.safeParse(body);
    if (!parsed.success) {
      logServerEvent('warn', 'ai.projection.invalid_request', { ...context, uid });
      return NextResponse.json({ error: "Invalid projection request." }, {
        status: 400,
        headers: { 'x-request-id': context.requestId },
      });
    }

    const result = await getCashFlowProjections(parsed.data);
    logServerEvent('info', 'ai.projection.completed', { ...context, uid });
    return NextResponse.json(result, { headers: { 'x-request-id': context.requestId } });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      logServerEvent('warn', 'ai.projection.unauthorized', context, error);
      return NextResponse.json({ error: error.message }, {
        status: 401,
        headers: { 'x-request-id': context.requestId },
      });
    }
    logServerEvent('error', 'ai.projection.failed', context, error);
    return NextResponse.json({ error: "Unable to generate a projection." }, {
      status: 500,
      headers: { 'x-request-id': context.requestId },
    });
  }
}
