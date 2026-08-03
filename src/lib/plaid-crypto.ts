import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

function encryptionKey() {
  const raw = process.env.PLAID_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("PLAID_TOKEN_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "PLAID_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  }
  return key;
}

export function encryptPlaidAccessToken(accessToken: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(accessToken, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return ["v1", iv, tag, ciphertext]
    .map((part) =>
      typeof part === "string" ? part : part.toString("base64url"),
    )
    .join(":");
}

export function decryptPlaidAccessToken(encrypted: string) {
  const [version, ivValue, tagValue, ciphertextValue] = encrypted.split(":");
  if (
    version !== "v1" ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue
  ) {
    throw new Error("Stored Plaid token has an unsupported format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
