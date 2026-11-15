import "server-only";

import { AuthenticationError, extractBearerToken } from "@/lib/auth-token";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestAppCheck } from "@/lib/requireUid";

export type AuthorizedBudgetViewer = {
  uid: string;
  grants: Array<{
    id: string;
    ownerUid: string;
    budgetIds: string[];
    displayName: string | null;
  }>;
};

export async function requireBudgetViewer(request: Request): Promise<AuthorizedBudgetViewer> {
  if (!adminAuth || !adminDb) throw new Error("Firebase Admin SDK is not initialized.");
  await verifyRequestAppCheck(request);
  const token = extractBearerToken(request.headers.get("authorization"));
  const decoded = await adminAuth.verifyIdToken(token);
  if (decoded.ledgerlyRole !== "budget_viewer") throw new AuthenticationError("Budget viewer session required");
  const mapping = await adminDb.collection("budgetPortalViewerMappings").doc(decoded.uid).get();
  if (!mapping.exists || mapping.data()?.status !== "active" || mapping.data()?.emailKey !== decoded.viewerKey) {
    throw new AuthenticationError("Budget viewer session is no longer active");
  }
  const grantsSnapshot = await adminDb.collection("budgetPortalGrants").where("viewerUid", "==", decoded.uid).get();
  const grants = grantsSnapshot.docs
    .filter((document) => document.data().status === "active")
    .map((document) => ({
      id: document.id,
      ownerUid: String(document.data().ownerUid),
      budgetIds: Array.isArray(document.data().budgetIds) ? document.data().budgetIds.filter((value: unknown): value is string => typeof value === "string") : [],
      displayName: typeof document.data().displayName === "string" ? document.data().displayName : null,
    }));
  if (grants.length === 0) throw new AuthenticationError("Budget access has been revoked");
  return { uid: decoded.uid, grants };
}
