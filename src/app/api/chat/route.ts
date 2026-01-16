import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // Temporary echo behavior so you can validate UI flows.
  // Replace this with your real model + tools layer later.
  const last = Array.isArray(body?.messages) ? body.messages[body.messages.length - 1] : null;
  const userText = typeof last?.content === "string" ? last.content : "";

  return NextResponse.json({
    reply: `Got it. You said:\n\n"${userText}"\n\n(Next step: I’ll wire this to your authenticated transaction tools.)`,
  });
}
