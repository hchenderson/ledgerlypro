import { NextResponse } from "next/server";

import {
  scanReceipt,
  ScanReceiptInputSchema,
} from "@/ai/flows/scan-receipt-flow";
import { AuthenticationError, requireUid } from "@/lib/requireUid";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_REQUEST_BYTES = 12_500_000;

export async function POST(req: Request) {
  try {
    const uid = await requireUid(req);
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "Receipt image is too large." }, { status: 413 });
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
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = ScanReceiptInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid receipt image." }, { status: 400 });
    }

    return NextResponse.json(await scanReceipt(parsed.data));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Receipt scan failed:", error);
    return NextResponse.json({ error: "Unable to scan this receipt." }, { status: 500 });
  }
}
