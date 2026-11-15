import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("@/lib/firebaseAdmin", () => ({
  adminAuth: { verifyIdToken },
  adminAppCheck: null,
}));

describe("owner API authentication", () => {
  beforeEach(() => {
    process.env.FIREBASE_APP_CHECK_MODE = "off";
    verifyIdToken.mockReset();
  });

  it("accepts an owner token", async () => {
    verifyIdToken.mockResolvedValue({ uid: "owner" });
    const { requireUid } = await import("./requireUid");
    await expect(requireUid(new Request("https://example.test", { headers: { authorization: "Bearer token" } }))).resolves.toBe("owner");
  });

  it("rejects a Budget Portal viewer even when its UID matches an owner path", async () => {
    verifyIdToken.mockResolvedValue({ uid: "owner", ledgerlyRole: "budget_viewer" });
    const { requireUid } = await import("./requireUid");
    await expect(requireUid(new Request("https://example.test", { headers: { authorization: "Bearer token" } }))).rejects.toThrow("Budget viewers cannot access owner APIs");
  });
});
