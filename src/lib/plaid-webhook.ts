import "server-only";

import {
  createHash,
  createPublicKey,
  timingSafeEqual,
  verify,
  type JsonWebKey,
} from "node:crypto";

import { plaidRequest } from "@/lib/plaid-client";

function decodeJson(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
}

export async function verifyPlaidWebhook(
  rawBody: string,
  verificationHeader: string | null,
) {
  if (!verificationHeader) return false;
  const parts = verificationHeader.split(".");
  if (parts.length !== 3) return false;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);
  if (
    header.alg !== "ES256" ||
    typeof header.kid !== "string" ||
    typeof payload.iat !== "number" ||
    typeof payload.request_body_sha256 !== "string"
  ) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    payload.iat > nowSeconds + 30 ||
    nowSeconds - payload.iat > 5 * 60
  ) {
    return false;
  }

  const verificationKey = await plaidRequest<{
    key: JsonWebKey;
  }>("webhook_verification_key/get", { key_id: header.kid });
  const publicKey = createPublicKey({
    key: verificationKey.key,
    format: "jwk",
  });
  const signatureValid = verify(
    "sha256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(encodedSignature, "base64url"),
  );
  if (!signatureValid) return false;

  const actualHash = Buffer.from(
    createHash("sha256").update(rawBody).digest("hex"),
    "utf8",
  );
  const expectedHash = Buffer.from(payload.request_body_sha256, "utf8");
  return (
    actualHash.length === expectedHash.length &&
    timingSafeEqual(actualHash, expectedHash)
  );
}
