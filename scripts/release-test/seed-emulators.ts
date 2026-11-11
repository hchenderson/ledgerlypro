import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const RELEASE_PROJECT_ID = "ledgerly-release-demo";
export const OWNER_UID = "release-owner";
export const OTHER_UID = "release-other";
export const OWNER_EMAIL = "owner@ledgerly.test";
export const OWNER_PASSWORD = "Ledgerly-Test-2026!";

const categoryDocuments = [
  {
    id: "giving",
    name: "Giving",
    type: "income",
    icon: "HandCoins",
    subCategories: [],
  },
  {
    id: "designated",
    name: "Designated",
    type: "income",
    icon: "HeartHandshake",
    subCategories: [],
  },
  {
    id: "operations",
    name: "Operations",
    type: "expense",
    icon: "Building2",
    subCategories: [
      { id: "supplies", name: "Supplies", icon: "Package", subCategories: [] },
      { id: "fees", name: "Fees", icon: "Receipt", subCategories: [] },
    ],
  },
];

const transaction = (
  id: string,
  amountMinor: number,
  type: "income" | "expense" | "transfer",
  extras: Record<string, unknown> = {},
) => ({
  id,
  date: "2026-02-15",
  ledgerDate: "2026-02-15",
  description: id,
  amount: amountMinor / 100,
  amountMinor,
  currency: "USD",
  type,
  category: "Uncategorized",
  accountId: "checking",
  postingStatus: "posted",
  source: "manual",
  ...extras,
});

export async function seedReleaseFixture() {
  if (process.env.GCLOUD_PROJECT !== RELEASE_PROJECT_ID) {
    throw new Error(`Refusing to seed project ${process.env.GCLOUD_PROJECT ?? "unset"}.`);
  }
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8085") {
    throw new Error("Firestore emulator is not available at the required host.");
  }
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099") {
    throw new Error("Auth emulator is not available at the required host.");
  }

  const app = initializeApp({ projectId: RELEASE_PROJECT_ID }, `release-seed-${Date.now()}`);
  const auth = getAuth(app);
  const db = getFirestore(app);
  await Promise.all([
    auth.createUser({ uid: OWNER_UID, email: OWNER_EMAIL, password: OWNER_PASSWORD, emailVerified: true }),
    auth.createUser({ uid: OTHER_UID, email: "other@ledgerly.test", password: OWNER_PASSWORD, emailVerified: true }),
  ]);

  const owner = db.collection("users").doc(OWNER_UID);
  const other = db.collection("users").doc(OTHER_UID);
  const batch = db.batch();
  batch.set(owner.collection("settings").doc("main"), {
    onboardingComplete: true,
    showInstructions: false,
    activeYear: 2026,
    firstYear: 2025,
    budgetingMode: "tracking",
    envelopeSettings: { minimumOperatingBalance: 0, fundingSuggestions: true },
    forecastSettings: {},
    reportingTimeZone: "America/New_York",
    primaryAccountId: "checking",
  });
  batch.set(other.collection("settings").doc("main"), {
    onboardingComplete: true,
    activeYear: 2026,
    firstYear: 2026,
    budgetingMode: "tracking",
    reportingTimeZone: "America/New_York",
  });
  batch.set(owner.collection("accounts").doc("checking"), {
    id: "checking",
    name: "Checking",
    type: "checking",
    classification: "asset",
    openingBalance: 1000,
    openingBalanceMinor: 100000,
    currency: "USD",
    isDefault: true,
    isActive: true,
    role: "operating",
    createdAt: "2025-01-01T00:00:00.000Z",
  });
  batch.set(owner.collection("accounts").doc("savings"), {
    id: "savings",
    name: "Savings",
    type: "savings",
    classification: "asset",
    openingBalance: 500,
    openingBalanceMinor: 50000,
    currency: "USD",
    isDefault: false,
    isActive: true,
    role: "standard",
    createdAt: "2025-01-01T00:00:00.000Z",
  });
  categoryDocuments.forEach((category) => {
    batch.set(owner.collection("categories").doc(category.id), category);
  });
  batch.set(owner.collection("budgets").doc("operations-budget"), {
    id: "operations-budget",
    categoryId: "operations",
    amount: 500,
    amountMinor: 50000,
    currency: "USD",
    period: "monthly",
    year: 2026,
  });
  batch.set(owner.collection("budgets").doc("supplies-budget"), {
    id: "supplies-budget",
    categoryId: "supplies",
    amount: 300,
    amountMinor: 30000,
    currency: "USD",
    period: "monthly",
    year: 2026,
  });

  const transactions = [
    transaction("giving", 100000, "income", { category: "Giving", categoryId: "giving" }),
    transaction("designated", 20000, "income", { category: "Designated", categoryId: "designated" }),
    transaction("split-expense", 12000, "expense", {
      category: "Split transaction",
      allocationStatus: "complete",
      allocations: [
        { id: "split-supplies", amount: 70, amountMinor: 7000, category: "Supplies", categoryId: "supplies" },
        { id: "split-fees", amount: 50, amountMinor: 5000, category: "Fees", categoryId: "fees" },
      ],
    }),
    transaction("recurring-actual", 10300, "expense", {
      date: "2026-11-08",
      ledgerDate: "2026-11-08",
      category: "Supplies",
      categoryId: "supplies",
      source: "plaid",
      provider: "plaid",
      providerTransactionId: "provider-recurring-actual",
      merchantName: "Rent Company",
    }),
    transaction("legacy-expectation", 10000, "expense", {
      category: "Supplies",
      categoryId: "supplies",
      source: "recurring",
      recurringExpectationOnly: true,
    }),
    transaction("pending", 90000, "expense", { postingStatus: "pending", categoryId: "supplies" }),
    transaction("removed", 80000, "expense", { postingStatus: "removed", providerRemovedAt: "2026-02-16T00:00:00.000Z", categoryId: "supplies" }),
    transaction("possible-transfer", 70000, "expense", { possibleTransfer: true, categoryId: "supplies" }),
    transaction("transfer-out", 30000, "transfer", {
      category: "Transfer",
      transferId: "seed-transfer",
      transferDirection: "out",
      linkedTransactionId: "transfer-in",
    }),
    transaction("transfer-in", 30000, "transfer", {
      category: "Transfer",
      accountId: "savings",
      transferId: "seed-transfer",
      transferDirection: "in",
      linkedTransactionId: "transfer-out",
    }),
    transaction("other-account", 5000, "expense", { accountId: "savings", category: "Supplies", categoryId: "supplies" }),
  ];
  transactions.forEach((item) => batch.set(owner.collection("transactions").doc(item.id as string), item));
  batch.set(owner.collection("recurringTransactions").doc("rent-schedule"), {
    id: "rent-schedule",
    description: "Rent Company",
    amount: 100,
    amountMinor: 10000,
    currency: "USD",
    type: "expense",
    category: "Supplies",
    categoryId: "supplies",
    accountId: "checking",
    frequency: "monthly",
    startDate: "2026-11-07",
  });
  batch.set(owner.collection("recurringOccurrences").doc("rent-schedule--2026-11-07"), {
    id: "rent-schedule--2026-11-07",
    recurringTransactionId: "rent-schedule",
    originalDueDate: "2026-11-07",
    expectedAmount: 100,
    expectedAmountMinor: 10000,
    remainingAmount: 100,
    remainingAmountMinor: 10000,
    matchedAmount: 0,
    matchedAmountMinor: 0,
    varianceAmount: 0,
    varianceAmountMinor: 0,
    type: "expense",
    category: "Supplies",
    categoryId: "supplies",
    accountId: "checking",
    description: "Rent Company",
    status: "expected",
    matches: [],
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  });
  await batch.commit();
  await deleteApp(app);
}
