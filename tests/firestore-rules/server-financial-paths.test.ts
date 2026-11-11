import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const PROJECT_ID = "ledgerly-sec002-test";
const UID = "api-owner-sec002";

process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = PROJECT_ID;

vi.mock("@/lib/requireUid", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireUid: vi.fn(async () => UID),
}));

let environment: RulesTestEnvironment;
let adminDb: FirebaseFirestore.Firestore;
let reconcilePost: (request: Request) => Promise<Response>;
let refundPost: (request: Request) => Promise<Response>;
let refundDelete: (request: Request) => Promise<Response>;
let rebuildSummariesPost: (request: Request) => Promise<Response>;

const request = (url: string, body: unknown, method = "POST") => new Request(url, {
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const occurrence = (id: string, dueDate = "2026-11-10T12:00:00.000Z") => ({
  id,
  recurringTransactionId: "rent-schedule",
  originalDueDate: dueDate,
  expectedAmount: 100,
  expectedAmountMinor: 10000,
  remainingAmount: 100,
  remainingAmountMinor: 10000,
  matchedAmount: 0,
  matchedAmountMinor: 0,
  varianceAmount: 0,
  varianceAmountMinor: 0,
  type: "expense",
  category: "Rent",
  categoryId: "rent",
  accountId: "checking",
  description: "Apartment rent",
  status: "expected",
  matches: [],
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
});

const transaction = (
  id: string,
  type: "income" | "expense",
  amountMinor: number,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  date: "2026-11-10T12:00:00.000Z",
  ledgerDate: "2026-11-10",
  description: type === "expense" ? "Apartment rent" : "Merchant refund",
  amount: amountMinor / 100,
  amountMinor,
  currency: "USD",
  type,
  category: type === "expense" ? "Rent" : "Uncategorized",
  categoryId: type === "expense" ? "rent" : "uncategorized",
  accountId: "checking",
  source: "plaid",
  provider: "plaid",
  providerTransactionId: `provider-${id}`,
  postingStatus: "posted",
  ...overrides,
});

beforeAll(async () => {
  environment = await initializeTestEnvironment({ projectId: PROJECT_ID });
  const firebaseAdmin = await import("@/lib/firebaseAdmin");
  const database = firebaseAdmin.adminDb;
  if (!database) throw new Error("Admin Firestore did not initialize for emulator tests.");
  adminDb = database;
  ({ POST: reconcilePost } = await import("@/app/api/recurring/reconcile/route"));
  ({ POST: refundPost, DELETE: refundDelete } = await import("@/app/api/refunds/link/route"));
  ({ POST: rebuildSummariesPost } = await import("@/app/api/financial-summaries/rebuild/route"));
});

beforeEach(async () => {
  await environment.clearFirestore();
});

afterAll(async () => {
  await environment.cleanup();
});

describe("trusted reconciliation API paths", () => {
  it("confirms once, safely retries, and keeps a competing occurrence from claiming the same actual", async () => {
    const user = adminDb.collection("users").doc(UID);
    await Promise.all([
      user.collection("settings").doc("main").set({ primaryAccountId: "checking" }),
      user.collection("recurringOccurrences").doc("occurrence-a").set(occurrence("occurrence-a")),
      user.collection("recurringOccurrences").doc("occurrence-b").set(occurrence("occurrence-b")),
      user.collection("transactions").doc("actual-rent").set(transaction("actual-rent", "expense", 10300)),
    ]);

    const input = {
      action: "confirm",
      occurrenceId: "occurrence-a",
      transactionId: "actual-rent",
      operationId: "confirm-operation-a",
    };
    const first = await reconcilePost(request("http://localhost/api/recurring/reconcile", input));
    const retry = await reconcilePost(request("http://localhost/api/recurring/reconcile", input));
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect((await retry.json()).idempotent).toBe(true);

    const competing = await reconcilePost(request("http://localhost/api/recurring/reconcile", {
      ...input,
      occurrenceId: "occurrence-b",
      operationId: "confirm-operation-b",
    }));
    expect(competing.status).toBe(409);

    const [actual, fulfilled, untouched, audits] = await Promise.all([
      user.collection("transactions").doc("actual-rent").get(),
      user.collection("recurringOccurrences").doc("occurrence-a").get(),
      user.collection("recurringOccurrences").doc("occurrence-b").get(),
      user.collection("recurringReconciliationEvents").get(),
    ]);
    expect(actual.data()?.recurringOccurrenceId).toBe("occurrence-a");
    expect(fulfilled.data()?.status).toBe("fulfilled");
    expect(fulfilled.data()?.matchedAmountMinor).toBe(10300);
    expect(untouched.data()?.status).toBe("expected");
    expect(audits.size).toBe(1);
  });

  it("links and unlinks a refund atomically and retries without double-counting", async () => {
    const user = adminDb.collection("users").doc(UID);
    await Promise.all([
      user.collection("transactions").doc("purchase").set(transaction("purchase", "expense", 10000, {
        description: "Office supplies",
        category: "Office",
        categoryId: "office",
      })),
      user.collection("transactions").doc("refund").set(transaction("refund", "income", 4000)),
    ]);

    const input = { refundTransactionId: "refund", originalTransactionId: "purchase" };
    const first = await refundPost(request("http://localhost/api/refunds/link", input));
    const retry = await refundPost(request("http://localhost/api/refunds/link", input));
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect((await user.collection("transactions").doc("refund").get()).data()).toMatchObject({
      refundOfTransactionId: "purchase",
      refundStatus: "confirmed",
      categoryId: "office",
      amountMinor: 4000,
    });

    const unlink = await refundDelete(request(
      "http://localhost/api/refunds/link",
      { refundTransactionId: "refund" },
      "DELETE",
    ));
    expect(unlink.status).toBe(200);
    const unlinked = (await user.collection("transactions").doc("refund").get()).data();
    expect(unlinked?.refundOfTransactionId).toBeUndefined();
    expect(unlinked?.refundStatus).toBeUndefined();
    expect(unlinked?.categorizationStatus).toBe("needs-review");
    expect((await user.collection("refundAuditEvents").get()).size).toBe(3);
  });

  it("rebuilds operational financial summaries from the server-owned ledger path", async () => {
    const user = adminDb.collection("users").doc(UID);
    await Promise.all([
      user.collection("settings").doc("main").set({ reportingTimeZone: "America/New_York" }),
      user.collection("transactions").doc("income").set(transaction("income", "income", 120000, {
        date: "2026-03-01T12:00:00.000Z",
        ledgerDate: "2026-03-01",
      })),
      user.collection("transactions").doc("expense").set(transaction("expense", "expense", 22300, {
        date: "2026-03-02T12:00:00.000Z",
        ledgerDate: "2026-03-02",
      })),
    ]);

    const response = await rebuildSummariesPost(request(
      "http://localhost/api/financial-summaries/rebuild",
      { year: 2026 },
    ));
    expect(response.status).toBe(200);
    const summary = await user.collection("financialSummaries").doc("year-2026").get();
    expect(summary.data()).toMatchObject({
      income: 1200,
      expenses: 223,
      net: 977,
      transactionCount: 2,
    });

    await Promise.all([
      user.collection("transactions").doc("income").delete(),
      user.collection("transactions").doc("expense").delete(),
    ]);
    const clearedResponse = await rebuildSummariesPost(request(
      "http://localhost/api/financial-summaries/rebuild",
      { year: 2026 },
    ));
    expect(clearedResponse.status).toBe(200);
    const clearedSummary = await user.collection("financialSummaries").doc("year-2026").get();
    expect(clearedSummary.data()).toMatchObject({
      income: 0,
      expenses: 0,
      net: 0,
      transactionCount: 0,
    });
  });
});
