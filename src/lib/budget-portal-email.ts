import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebaseAdmin";

type PortalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  correlationId: string;
  kind: "pin" | "invitation";
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]!);
}

export async function sendBudgetPortalEmail(message: PortalEmail) {
  const provider = process.env.BUDGET_PORTAL_EMAIL_PROVIDER ?? "test";
  if (provider === "test") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("The test email transport is forbidden in production.");
    }
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    await adminDb.collection("budgetPortalTestEmails").doc(message.correlationId).set({
      ...message,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1_000),
    });
    return;
  }
  if (provider !== "resend") throw new Error("Unsupported budget portal email provider.");
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BUDGET_PORTAL_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Budget Portal email delivery is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
  });
  if (!response.ok) throw new Error(`Budget Portal email provider returned ${response.status}.`);
}

export function portalPinEmail(to: string, pin: string, correlationId: string) {
  return sendBudgetPortalEmail({
    to,
    correlationId,
    kind: "pin",
    subject: `${pin} is your Ledgerly budget code`,
    text: `Your one-time Ledgerly budget code is ${pin}. It expires in 10 minutes and can be used once. If you did not request it, you can ignore this email.`,
    html: `<div style="font-family:Inter,Arial,sans-serif;color:#1a1f24"><h1 style="color:#285943">Ledgerly Pro</h1><p>Use this one-time code to view your assigned budget:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${pin}</p><p>This code expires in 10 minutes and can be used once.</p><p>If you did not request it, you can ignore this email.</p></div>`,
  });
}

export function portalInvitationEmail(to: string, displayName: string | null, correlationId: string) {
  const greeting = displayName ? `Hello ${displayName},` : "Hello,";
  const htmlGreeting = escapeHtml(greeting);
  return sendBudgetPortalEmail({
    to,
    correlationId,
    kind: "invitation",
    subject: "You can now view a budget in Ledgerly",
    text: `${greeting}\n\nA Ledgerly owner has granted you read-only access to a budget summary. Open the Ledgerly sign-in page and choose “View a budget with a code,” then enter this email address.`,
    html: `<div style="font-family:Inter,Arial,sans-serif;color:#1a1f24"><h1 style="color:#285943">Ledgerly Pro</h1><p>${htmlGreeting}</p><p>A Ledgerly owner has granted you read-only access to a budget summary.</p><p>Open the Ledgerly sign-in page and choose <strong>View a budget with a code</strong>, then enter this email address.</p></div>`,
  });
}
