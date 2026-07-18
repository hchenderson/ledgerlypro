import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthenticationError, requireUid } from "@/lib/requireUid";
import { deleteQuarterlyReport, generateQuarterlyReport } from "@/lib/quarterly-reports-server";
import { logServerEvent, requestLogContext } from "@/lib/server-logger";

const GenerateReportSchema = z.object({
  referenceDate: z.string().datetime(),
  notes: z.string().trim().max(2_000).optional(),
  budgetIds: z.array(z.string().min(1)).max(200).optional(),
});

const DeleteReportSchema = z.object({
  reportId: z.string().regex(/^Q[1-4] \d{4}$/),
});

export async function POST(req: Request) {
  const baseContext = requestLogContext(req, "quarterly-report.generate");
  try {
    const uid = await requireUid(req);
    const context = { ...baseContext, uid };
    const parsed = GenerateReportSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      logServerEvent("warn", "request.invalid", context);
      return NextResponse.json({ error: "Invalid report request." }, {
        status: 400,
        headers: { "x-request-id": baseContext.requestId },
      });
    }

    const report = await generateQuarterlyReport({
      uid,
      referenceDate: new Date(parsed.data.referenceDate),
      notes: parsed.data.notes,
      budgetIds: parsed.data.budgetIds,
    });
    logServerEvent("info", "quarterly-report.generated", { ...context, period: report.period });
    return NextResponse.json({ report }, {
      headers: { "x-request-id": baseContext.requestId },
    });
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : 500;
    logServerEvent("error", "quarterly-report.generate.failed", baseContext, error);
    return NextResponse.json(
      { error: status === 401 ? "Authentication required." : "Unable to generate report." },
      { status, headers: { "x-request-id": baseContext.requestId } }
    );
  }
}

export async function DELETE(req: Request) {
  const baseContext = requestLogContext(req, "quarterly-report.delete");
  try {
    const uid = await requireUid(req);
    const context = { ...baseContext, uid };
    const parsed = DeleteReportSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      logServerEvent("warn", "request.invalid", context);
      return NextResponse.json({ error: "Invalid report identifier." }, {
        status: 400,
        headers: { "x-request-id": baseContext.requestId },
      });
    }

    await deleteQuarterlyReport(uid, parsed.data.reportId);
    logServerEvent("info", "quarterly-report.deleted", { ...context, reportId: parsed.data.reportId });
    return NextResponse.json({ success: true }, {
      headers: { "x-request-id": baseContext.requestId },
    });
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : 500;
    logServerEvent("error", "quarterly-report.delete.failed", baseContext, error);
    return NextResponse.json(
      { error: status === 401 ? "Authentication required." : "Unable to delete report." },
      { status, headers: { "x-request-id": baseContext.requestId } }
    );
  }
}
