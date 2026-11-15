import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { requireBudgetViewer } from "@/lib/budget-portal-auth";
import { buildBudgetPortalSummary } from "@/lib/budget-portal-summary";
import { AuthenticationError } from "@/lib/auth-token";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(request: Request) {
  try {
    const viewer = await requireBudgetViewer(request);
    const results = await Promise.all(viewer.grants.map(async (grant) => ({
      grant,
      summary: await buildBudgetPortalSummary({
        ownerUid: grant.ownerUid,
        budgetIds: grant.budgetIds,
        displayName: grant.displayName,
      }),
    })));
    const primary = results[0].summary;
    const combined = {
      ...primary,
      budgets: results.flatMap(({ grant, summary }) => summary.budgets.map((budget) => ({ ...budget, id: `${grant.id}:${budget.id}` }))),
      unavailableAssignments: results.reduce((total, item) => total + item.summary.unavailableAssignments, 0),
      notice: results.some((item) => item.summary.notice) ? "Some budget cards overlap by category. Each card is accurate on its own; do not add overlapping cards together." : null,
    };
    if (adminDb) {
      await adminDb.collection("budgetPortalViewerMappings").doc(viewer.uid).set({ lastPortalRefreshAt: Timestamp.now() }, { merge: true });
    }
    return NextResponse.json(combined, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Your budget access is no longer active. Request a new code or contact the budget owner." : "Budget information could not be loaded." },
      { status, headers: { "cache-control": "private, no-store" } },
    );
  }
}
