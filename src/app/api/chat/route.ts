import { NextResponse } from "next/server";
import { requireUid } from "@/lib/requireUid";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    if (!adminDb) {
      throw new Error("Firebase Admin SDK is not initialized. Check server configuration and environment variables.");
    }
    const uid = await requireUid(req);

    // Hard scope: everything begins at users/{uid}
    const userDoc = adminDb.collection("users").doc(uid);

    // Quick proof of access (optional)
    const userSnap = await userDoc.get();
    const displayName = userSnap.exists ? (userSnap.data()?.displayName ?? null) : null;

    const body = await req.json().catch(() => ({}));
    const last = Array.isArray(body?.messages) ? body.messages.at(-1) : null;
    const text = typeof last?.content === "string" ? last.content : "";

    return NextResponse.json({
      reply: `✅ Auth OK${displayName ? `, ${displayName}` : ""}.\n\nYou said: "${text}"`,
    });
  } catch (err: any) {
    console.error("[/api/chat Error]", err);
    // Distinguish between auth errors (client's fault) and server errors
    const isAuthError = err.code && typeof err.code === 'string' && err.code.startsWith('auth/');
    if (isAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    // For other errors, especially our custom initialization error, it's a server problem.
    return NextResponse.json({ error: err.message ?? "An unexpected server error occurred." }, { status: 500 });
  }
}
