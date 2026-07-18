import { NextResponse } from "next/server";

import {
  scanReceipt,
  ScanReceiptInputSchema,
} from "@/ai/flows/scan-receipt-flow";
import { AuthenticationError, requireUid } from "@/lib/requireUid";
import { checkRateLimit } from "@/lib/rate-limit";
import { logServerEvent, requestLogContext } from "@/lib/server-logger";

const MAX_REQUEST_BYTES = 12_500_000;

export async function POST(req: Request) {
  const context = requestLogContext(req, 'ai.receipt');
  try {
    const uid = await requireUid(req);
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "Receipt image is too large." }, {
        status: 413,
        headers: { 'x-request-id': context.requestId },
      });
    }

    const rateLimit = checkRateLimit({
      key: `receipt:${uid}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many receipt scans. Please wait and try again." },
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
    const parsed = ScanReceiptInputSchema.safeParse(body);
    if (!parsed.success) {
      logServerEvent('warn', 'ai.receipt.invalid_request', { ...context, uid });
      return NextResponse.json({ error: "Invalid receipt image." }, {
        status: 400,
        headers: { 'x-request-id': context.requestId },
      });
    }

    const result = await scanReceipt(parsed.data);
    logServerEvent('info', 'ai.receipt.completed', { ...context, uid });
    return NextResponse.json(result, { headers: { 'x-request-id': context.requestId } });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      logServerEvent('warn', 'ai.receipt.unauthorized', context, error);
      return NextResponse.json({ error: error.message }, {
        status: 401,
        headers: { 'x-request-id': context.requestId },
      });
    }
    logServerEvent('error', 'ai.receipt.failed', context, error);
    return NextResponse.json({ error: "Unable to scan this receipt." }, {
      status: 500,
      headers: { 'x-request-id': context.requestId },
    });
  }
}
