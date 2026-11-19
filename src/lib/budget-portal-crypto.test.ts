import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("Budget Portal PIN protection", () => {
  it("creates six-digit codes and keyed, challenge-specific verifiers", async () => {
    process.env.BUDGET_PORTAL_PIN_PEPPER = "test-only-budget-portal-pepper-value";
    const {
      createPortalPin,
      portalPinVerifier,
      portalVerifierMatches,
    } = await import("./budget-portal-crypto");
    const code = createPortalPin();
    expect(code).toMatch(/^\d{6}$/);
    const first = portalPinVerifier("challenge-one", code);
    const second = portalPinVerifier("challenge-two", code);
    expect(first).not.toBe(second);
    expect(first).not.toContain(code);
    expect(portalVerifierMatches(first, portalPinVerifier("challenge-one", code))).toBe(true);
    expect(portalVerifierMatches(first, portalPinVerifier("challenge-one", "000000"))).toBe(false);
  });
});
