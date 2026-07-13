import { describe, expect, it } from "vitest";

import { AuthenticationError, extractBearerToken } from "./auth-token";

describe("extractBearerToken", () => {
  it("extracts a Firebase ID token", () => {
    expect(extractBearerToken("Bearer signed-token")).toBe("signed-token");
  });

  it("rejects unauthenticated requests", () => {
    expect(() => extractBearerToken(null)).toThrow(AuthenticationError);
    expect(() => extractBearerToken("Basic value")).toThrow(AuthenticationError);
  });
});
