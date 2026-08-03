import "server-only";

import { NextResponse } from "next/server";

import { AuthenticationError } from "@/lib/auth-token";
import { PlaidApiError } from "@/lib/plaid-client";

export function plaidRouteError(error: unknown) {
  console.error("Plaid route failed:", error);
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof PlaidApiError) {
    const reconnectRequired = new Set([
      "ITEM_LOGIN_REQUIRED",
      "PENDING_EXPIRATION",
      "PENDING_DISCONNECT",
    ]).has(error.errorCode ?? "");
    return NextResponse.json(
      {
        error: error.message,
        code: error.errorCode,
        reconnectRequired,
        requestId: error.requestId,
      },
      { status: reconnectRequired ? 409 : 502 },
    );
  }
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "The bank connection request could not be completed.",
    },
    { status: 500 },
  );
}

export function requiredString(
  value: unknown,
  fieldName: string,
  maximumLength = 500,
) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
  return value.trim().slice(0, maximumLength);
}
