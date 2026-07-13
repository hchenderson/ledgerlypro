import { beforeEach, describe, expect, it } from "vitest";

import { checkRateLimit, resetRateLimitsForTests } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(resetRateLimitsForTests);

  it("limits repeated requests within the same window", () => {
    expect(checkRateLimit({ key: "user", limit: 1, windowMs: 1_000, now: 0 }).allowed).toBe(true);
    expect(checkRateLimit({ key: "user", limit: 1, windowMs: 1_000, now: 1 }).allowed).toBe(false);
    expect(checkRateLimit({ key: "user", limit: 1, windowMs: 1_000, now: 1_001 }).allowed).toBe(true);
  });
});
