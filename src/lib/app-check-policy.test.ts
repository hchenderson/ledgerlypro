import { describe, expect, it } from "vitest";

import { resolveAppCheckMode } from "./app-check-policy";

describe("resolveAppCheckMode", () => {
  it("defaults to off for an unconfigured local environment", () => {
    expect(resolveAppCheckMode({})).toBe("off");
  });

  it("supports explicit staged modes", () => {
    expect(resolveAppCheckMode({ FIREBASE_APP_CHECK_MODE: "monitor" })).toBe("monitor");
    expect(resolveAppCheckMode({ FIREBASE_APP_CHECK_MODE: "enforce" })).toBe("enforce");
    expect(resolveAppCheckMode({ FIREBASE_APP_CHECK_MODE: "OFF" })).toBe("off");
  });

  it("keeps the old boolean variable as a compatibility fallback", () => {
    expect(resolveAppCheckMode({ FIREBASE_APP_CHECK_ENFORCED: "true" })).toBe("enforce");
    expect(resolveAppCheckMode({ FIREBASE_APP_CHECK_ENFORCED: "false" })).toBe("monitor");
  });
});
