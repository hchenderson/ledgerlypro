import "server-only";

import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

function pinPepper() {
  const value = process.env.BUDGET_PORTAL_PIN_PEPPER;
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BUDGET_PORTAL_PIN_PEPPER is required.");
    }
    return "local-budget-portal-pepper-not-for-production";
  }
  if (process.env.NODE_ENV === "production" && value.length < 32) {
    throw new Error("BUDGET_PORTAL_PIN_PEPPER must contain at least 32 characters.");
  }
  return value;
}

export function normalizePortalEmail(value: string) {
  return value.trim().toLowerCase();
}

export function portalEmailKey(email: string) {
  return createHmac("sha256", pinPepper())
    .update(`email:${normalizePortalEmail(email)}`)
    .digest("hex");
}

export function portalSourceKey(value: string) {
  return createHmac("sha256", pinPepper())
    .update(`source:${value}`)
    .digest("hex");
}

export function createPortalPin() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function createPortalChallengeId() {
  return randomBytes(24).toString("base64url");
}

export function portalPinVerifier(challengeId: string, pin: string) {
  return createHmac("sha256", pinPepper())
    .update(`pin:${challengeId}:${pin}`)
    .digest("hex");
}

export function portalVerifierMatches(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return expectedBuffer.length === actualBuffer.length
    && timingSafeEqual(expectedBuffer, actualBuffer);
}
