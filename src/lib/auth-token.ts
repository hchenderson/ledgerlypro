export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function extractBearerToken(header: string | null): string {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new AuthenticationError("Missing Authorization Bearer token");
  }
  return match[1];
}
