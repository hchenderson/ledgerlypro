import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const PROJECT_ID = "ledgerly-sec002-test";
const ALICE = "alice-sec002";
const BOB = "bob-sec002";

let environment: RulesTestEnvironment;

const manualTransaction = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  date: "2026-02-03",
  ledgerDate: "2026-02-03",
  description: "Synthetic groceries",
  amount: 12.34,
  amountMinor: 1234,
  currency: "USD",
  type: "expense",
  category: "Groceries",
  categoryId: "groceries",
  accountId: "checking",
  source: "actual",
  ...overrides,
});

const manualAccount = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: "Synthetic checking",
  type: "checking",
  classification: "asset",
  openingBalance: 100,
  openingBalanceMinor: 10000,
  currency: "USD",
  role: "operating",
  isDefault: true,
  isArchived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

async function seed(path: string, data: Record<string, unknown>) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

beforeAll(async () => {
  const rules = await readFile(resolve(process.cwd(), "firestore.rules"), "utf8");
  environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8085,
      rules,
    },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
});

afterAll(async () => {
  await environment.cleanup();
});

describe("owner isolation and normal reads", () => {
  it("allows owner document, collection-query, and listener reads but denies another user", async () => {
    await seed(`users/${ALICE}/transactions/one`, manualTransaction("one"));
    const alice = environment.authenticatedContext(ALICE).firestore();
    const bob = environment.authenticatedContext(BOB).firestore();

    await assertSucceeds(getDoc(doc(alice, `users/${ALICE}/transactions/one`)));
    const ownQuery = query(collection(alice, `users/${ALICE}/transactions`));
    await assertSucceeds(getDocs(ownQuery));
    await assertFails(getDoc(doc(bob, `users/${ALICE}/transactions/one`)));
    await assertFails(getDocs(query(collection(bob, `users/${ALICE}/transactions`))));

    const listenerCount = await new Promise<number>((resolveListener, rejectListener) => {
      const unsubscribe = onSnapshot(
        ownQuery,
        (snapshot) => {
          unsubscribe();
          resolveListener(snapshot.size);
        },
        rejectListener,
      );
    });
    expect(listenerCount).toBe(1);
  });

  it("denies unauthenticated access and unknown user collections", async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    const alice = environment.authenticatedContext(ALICE).firestore();
    await assertFails(getDocs(collection(anonymous, `users/${ALICE}/transactions`)));
    await assertFails(setDoc(doc(alice, `users/${ALICE}/unreviewedCollection/one`), { id: "one" }));
  });
});

describe("transactions and DATA-001 compatibility", () => {
  it("allows valid canonical and legacy manual entries", async () => {
    const alice = environment.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(
      doc(alice, `users/${ALICE}/transactions/canonical`),
      manualTransaction("canonical"),
    ));
    await assertSucceeds(setDoc(
      doc(alice, `users/${ALICE}/transactions/legacy`),
      {
        id: "legacy",
        date: "2025-12-31T12:00:00.000Z",
        description: "Legacy expense",
        amount: 20,
        type: "expense",
        category: "Legacy",
        accountId: "checking",
      },
    ));
  });

  it("denies malformed amounts, dates, unexpected fields, and conflicting canonical values", async () => {
    const alice = environment.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(
      doc(alice, `users/${ALICE}/transactions/mismatch`),
      manualTransaction("mismatch", { amountMinor: 1235 }),
    ));
    await assertFails(setDoc(
      doc(alice, `users/${ALICE}/transactions/date`),
      manualTransaction("date", { ledgerDate: "02/03/2026" }),
    ));
    await assertFails(setDoc(
      doc(alice, `users/${ALICE}/transactions/extra`),
      manualTransaction("extra", { arbitraryAdminField: true }),
    ));
    await assertFails(setDoc(
      doc(alice, `users/${ALICE}/transactions/huge`),
      manualTransaction("huge", { amount: 90_000_000_001, amountMinor: 9_000_000_000_100 }),
    ));
  });

  it("permits unrelated edits to legacy and canonical records", async () => {
    await seed(`users/${ALICE}/transactions/legacy`, {
      id: "legacy",
      date: "2025-12-31T12:00:00.000Z",
      description: "Legacy expense",
      amount: 20,
      type: "expense",
      category: "Legacy",
      accountId: "checking",
    });
    await seed(`users/${ALICE}/transactions/canonical`, manualTransaction("canonical"));
    const alice = environment.authenticatedContext(ALICE).firestore();
    await assertSucceeds(updateDoc(
      doc(alice, `users/${ALICE}/transactions/legacy`),
      { category: "Updated legacy" },
    ));
    await assertSucceeds(updateDoc(
      doc(alice, `users/${ALICE}/transactions/canonical`),
      { description: "Updated canonical" },
    ));
    await assertFails(updateDoc(
      doc(alice, `users/${ALICE}/transactions/canonical`),
      { amountMinor: 999 },
    ));
  });

  it("protects Plaid status/provenance and recurring/refund links", async () => {
    await seed(`users/${ALICE}/transactions/plaid`, manualTransaction("plaid", {
      date: "2026-02-03T12:30:00.000Z",
      source: "plaid",
      provider: "plaid",
      providerItemId: "item",
      providerTransactionId: "provider-tx",
      postingStatus: "posted",
    }));
    await seed(`users/${ALICE}/transactions/linked`, manualTransaction("linked", {
      recurringOccurrenceId: "occurrence-1",
      recurringOriginalDueDate: "2026-02-01",
      recurringExpectedAmount: 12.34,
      recurringReconciliationStatus: "confirmed",
    }));
    const alice = environment.authenticatedContext(ALICE).firestore();

    await assertSucceeds(updateDoc(
      doc(alice, `users/${ALICE}/transactions/plaid`),
      { category: "Food", categoryId: "food", classificationLocked: true },
    ));
    await assertFails(updateDoc(
      doc(alice, `users/${ALICE}/transactions/plaid`),
      { postingStatus: "removed" },
    ));
    await assertFails(updateDoc(
      doc(alice, `users/${ALICE}/transactions/plaid`),
      { providerTransactionId: "different" },
    ));
    await assertFails(updateDoc(
      doc(alice, `users/${ALICE}/transactions/plaid`),
      { amount: 99, amountMinor: 9900 },
    ));
    await assertFails(updateDoc(
      doc(alice, `users/${ALICE}/transactions/plaid`),
      { refundOfTransactionId: "purchase" },
    ));
    await assertFails(updateDoc(
      doc(alice, `users/${ALICE}/transactions/linked`),
      { amount: 13, amountMinor: 1300 },
    ));
    await assertSucceeds(updateDoc(
      doc(alice, `users/${ALICE}/transactions/linked`),
      { description: "User note changed" },
    ));
    await assertFails(deleteDoc(doc(alice, `users/${ALICE}/transactions/plaid`)));
  });

  it("requires both sides of a transfer in one atomic batch", async () => {
    const alice = environment.authenticatedContext(ALICE).firestore();
    const outgoing: Record<string, unknown> = manualTransaction("out", {
      type: "transfer",
      category: "Transfer",
      categoryId: undefined,
      accountId: "checking",
      transferId: "transfer-1",
      transferDirection: "out",
      transferPurpose: "ordinary",
      linkedTransactionId: "in",
    });
    delete outgoing.categoryId;
    const incoming = {
      ...outgoing,
      id: "in",
      accountId: "savings",
      transferDirection: "in",
      linkedTransactionId: "out",
    };

    await assertFails(setDoc(doc(alice, `users/${ALICE}/transactions/out`), outgoing));
    const createBatch = writeBatch(alice);
    createBatch.set(doc(alice, `users/${ALICE}/transactions/out`), outgoing);
    createBatch.set(doc(alice, `users/${ALICE}/transactions/in`), incoming);
    await assertSucceeds(createBatch.commit());

    await assertFails(deleteDoc(doc(alice, `users/${ALICE}/transactions/out`)));
    const deleteBatch = writeBatch(alice);
    deleteBatch.delete(doc(alice, `users/${ALICE}/transactions/out`));
    deleteBatch.delete(doc(alice, `users/${ALICE}/transactions/in`));
    await assertSucceeds(deleteBatch.commit());
  });
});

describe("collection-specific contracts", () => {
  it("allows representative legitimate setup, budget, envelope, and report-view batch writes", async () => {
    const alice = environment.authenticatedContext(ALICE).firestore();
    const batch = writeBatch(alice);
    batch.set(doc(alice, `users/${ALICE}/accounts/checking`), manualAccount("checking"));
    batch.set(doc(alice, `users/${ALICE}/categories/groceries`), {
      id: "groceries", name: "Groceries", type: "expense", subCategories: [],
    });
    batch.set(doc(alice, `users/${ALICE}/budgets/grocery-budget`), {
      id: "grocery-budget", categoryId: "groceries", amount: 500,
      amountMinor: 50000, currency: "USD", period: "monthly", year: 2026,
    });
    batch.set(doc(alice, `users/${ALICE}/envelopes/food`), {
      id: "food", name: "Food", type: "monthly-spending", categoryIds: ["groceries"],
      fundingFrequency: "monthly", priority: 1, rollover: "rollover",
      color: "#285943", icon: "wallet", isArchived: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    batch.set(doc(alice, `users/${ALICE}/envelopeEvents/start`), {
      id: "start", envelopeId: "food", type: "starting-allocation",
      amount: 100, amountMinor: 10000, currency: "USD", date: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    batch.set(doc(alice, `users/${ALICE}/reportViews/view-1`), {
      id: "view-1", name: "First half", configuration: { from: "2026-01-01", to: "2026-06-30" },
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await assertSucceeds(batch.commit());
  });

  it("validates settings, accounts, budgets, goals, schedules, and summaries", async () => {
    const alice = environment.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(doc(alice, `users/${ALICE}/settings/main`), {
      onboardingComplete: true,
      activeYear: 2026,
      budgetingMode: "hybrid",
      reportingTimeZone: "America/New_York",
      envelopeSettings: { minimumOperatingBalance: 500, fundingSuggestions: true },
    }));
    await assertFails(setDoc(doc(alice, `users/${ALICE}/settings/main`), { activeYear: "2026" }));
    await assertFails(setDoc(doc(alice, `users/${ALICE}/accounts/bad`), manualAccount("bad", {
      openingBalance: 100,
      openingBalanceMinor: 9999,
    })));
    await assertFails(setDoc(doc(alice, `users/${ALICE}/budgets/bad`), {
      id: "bad", categoryId: "groceries", amount: -1, period: "monthly", year: 2026,
    }));
    await assertSucceeds(setDoc(doc(alice, `users/${ALICE}/goals/goal`), {
      id: "goal", name: "Reserve", targetAmount: 1000, savedAmount: 100,
    }));
    await assertSucceeds(setDoc(doc(alice, `users/${ALICE}/recurringTransactions/rent`), {
      id: "rent", description: "Rent", amount: 1000, amountMinor: 100000,
      currency: "USD", type: "expense", category: "Rent", accountId: "checking",
      frequency: "monthly", startDate: "2026-01-01",
    }));
    await assertFails(setDoc(doc(alice, `users/${ALICE}/financialSummaries/year-2026`), {
      id: "year-2026", version: 3, period: "year", year: 2026, income: 1200,
      expenses: 223, net: 977, balanceChange: 977, transactionCount: 10,
      sourceFingerprint: "10:synthetic",
    }));
  });

  it("preserves provider-owned account fields during user edits", async () => {
    await seed(`users/${ALICE}/accounts/plaid-account`, manualAccount("plaid-account", {
      plaidItemId: "item-1",
      plaidAccountId: "provider-account",
      institutionCurrentBalance: 750,
      institutionBalanceUpdatedAt: "2026-02-03T12:00:00.000Z",
    }));
    const alice = environment.authenticatedContext(ALICE).firestore();
    await assertSucceeds(updateDoc(
      doc(alice, `users/${ALICE}/accounts/plaid-account`),
      { name: "User display name", role: "standard" },
    ));
    await assertFails(updateDoc(
      doc(alice, `users/${ALICE}/accounts/plaid-account`),
      { institutionCurrentBalance: 999 },
    ));
    await assertFails(deleteDoc(doc(alice, `users/${ALICE}/accounts/plaid-account`)));
  });
});

describe("server-owned collections", () => {
  const protectedCollections = [
    "plaidItems",
    "balanceSnapshots",
    "recurringOccurrences",
    "recurringReconciliationEvents",
    "refundAuditEvents",
    "categorizationAudit",
    "reports",
    "financialSummaries",
  ];

  it("allows owner reads but denies every direct client mutation", async () => {
    const alice = environment.authenticatedContext(ALICE).firestore();
    for (const collectionName of protectedCollections) {
      await seed(`users/${ALICE}/${collectionName}/one`, { id: "one", value: "server" });
      await assertSucceeds(getDoc(doc(alice, `users/${ALICE}/${collectionName}/one`)));
      await assertSucceeds(getDocs(collection(alice, `users/${ALICE}/${collectionName}`)));
      await assertFails(setDoc(
        doc(alice, `users/${ALICE}/${collectionName}/client-write`),
        { id: "client-write" },
      ));
      await assertFails(updateDoc(
        doc(alice, `users/${ALICE}/${collectionName}/one`),
        { value: "changed" },
      ));
      await assertFails(deleteDoc(doc(alice, `users/${ALICE}/${collectionName}/one`)));
    }
  });

  it("denies categorization-rule bypasses and root operational collections", async () => {
    const alice = environment.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(alice, `users/${ALICE}/categorizationRules/rule`), {
      id: "rule", name: "Bypass", enabled: true, priority: 1,
      conditions: {}, actions: {}, createdAt: "now", updatedAt: "now",
    }));
    for (const path of [
      "plaidSecrets/alice/items/item",
      "plaidItemOwners/item",
      "plaidWebhookInbox/job",
      "plaidOperations/job",
      "rateLimitBuckets/bucket",
    ]) {
      await assertFails(getDoc(doc(alice, path)));
      await assertFails(setDoc(doc(alice, path), { value: "no" }));
    }
  });
});

describe("previous-client compatibility with proposed rules", () => {
  it("documents blocked legacy writes and the old clear-data partial-write hazard", async () => {
    await seed(`users/${ALICE}/transactions/legacy-clear-target`, manualTransaction("legacy-clear-target"));
    await seed(`users/${ALICE}/reports/immutable-snapshot`, { id: "immutable-snapshot", period: "Q1 2026" });
    const alice = environment.authenticatedContext(ALICE).firestore();

    await assertFails(setDoc(doc(alice, `users/${ALICE}/categorizationRules/legacy-rule`), {
      id: "legacy-rule",
      name: "Legacy direct rule",
      enabled: true,
      priority: 1,
      conditions: {},
      actions: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }));
    await assertFails(setDoc(doc(alice, `users/${ALICE}/categorizationAudit/legacy-audit`), {
      id: "legacy-audit",
      type: "rule-created",
      createdAt: "2026-01-01T00:00:00.000Z",
    }));

    // The old clear-data client deleted collections sequentially. It can delete
    // an ordinary transaction before a later immutable snapshot deletion is denied.
    await assertSucceeds(deleteDoc(doc(alice, `users/${ALICE}/transactions/legacy-clear-target`)));
    await assertFails(deleteDoc(doc(alice, `users/${ALICE}/reports/immutable-snapshot`)));
  });
});
