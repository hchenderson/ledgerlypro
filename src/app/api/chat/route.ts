import { NextResponse } from "next/server";
import { requireUid } from "@/lib/requireUid";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
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
    return NextResponse.json(
      { error: err?.message ?? "Unauthorized" },
      { status: 401 }
    );
  }
}
