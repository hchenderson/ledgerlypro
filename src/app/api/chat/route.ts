import { NextResponse } from "next/server";
import { adminAuth } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized: No token provided.' }, { status: 401 });
  }

  const idToken = authHeader.split('Bearer ')[1];
  let decodedToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (error) {
    console.error('Error verifying ID token:', error);
    return NextResponse.json({ error: 'Unauthorized: Invalid token.' }, { status: 401 });
  }

  const uid = decodedToken.uid;

  const body = await req.json().catch(() => ({}));

  // Temporary echo behavior so you can validate UI flows.
  // Replace this with your real model + tools layer later.
  const last = Array.isArray(body?.messages) ? body.messages[body.messages.length - 1] : null;
  const userText = typeof last?.content === "string" ? last.content : "";

  return NextResponse.json({
    reply: `Successfully authenticated as user: ${uid}.\n\nYou said:\n\n"${userText}"\n\n(Next step: I’ll wire this to your authenticated transaction tools.)`,
  });
}
