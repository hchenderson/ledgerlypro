import { NextResponse } from "next/server";
import { requireUid } from "@/lib/require-auth";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const uid = await requireUid(req);

    // In the next step, ALL reads/writes must live under this prefix:
    const userRoot = adminDb.collection("users").doc(uid);

    // For now, just prove identity + scoping works:
    const settingsSnap = await userRoot.collection("settings").doc("main").get();
    const onboardingComplete = settingsSnap.exists
      ? Boolean(settingsSnap.data()?.onboardingComplete)
      : false;

    const body = await req.json().catch(() => ({}));
    const last = Array.isArray(body?.messages) ? body.messages.at(-1) : null;
    const text = typeof last?.content === "string" ? last.content : "";

    return NextResponse.json({
      reply: `✅ Authenticated as uid=${uid}\nOnboarding complete: ${onboardingComplete}\n\nYou said: "${text}"`,
    });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
