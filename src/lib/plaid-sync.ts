import "server-only";

import { createHash } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebaseAdmin";
import { transactionBalanceDelta } from "@/lib/accounts";
import { buildFinancialAggregateDocuments } from "@/lib/financial-aggregates";
import { envelopeEventForTransaction } from "@/lib/envelopes";
import {
  PlaidApiError,
  plaidRequest,
} from "@/lib/plaid-client";
import { decryptPlaidAccessToken } from "@/lib/plaid-crypto";
import { withoutUndefined } from "@/lib/firestore-values";
import {
  normalizePlaidTransaction,
  stablePlaidTransactionDocumentId,
  type PlaidAccountPayload,
  type PlaidTransactionPayload,
} from "@/lib/plaid-mapping";
import type {
  Account,
  CategorizationRule,
  PlaidItemStatus,
  Transaction,
} from "@/types";

interface PlaidSyncResponse {
  added: PlaidTransactionPayload[];
  modified: PlaidTransactionPayload[];
  removed: Array<{ transaction_id: string }>;
  next_cursor: string;
  has_more: boolean;
}

interface PlaidAccountsResponse {
  accounts: PlaidAccountPayload[];
  item?: {
    item_id: string;
    institution_id?: string | null;
    institution_name?: string | null;
    consent_expiration_time?: string | null;
    error?: { error_code?: string; error_message?: string } | null;
  };
}

interface PlaidItemSecret {
  encryptedAccessToken: string;
}

const MAX_SYNC_RESTARTS = 3;
const WRITE_CHUNK_SIZE = 120;

function userRef(uid: string) {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
  return adminDb.collection("users").doc(uid);
}

function privateItemRef(uid: string, plaidItemId: string) {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
  return adminDb
    .collection("plaidSecrets")
    .doc(uid)
    .collection("items")
    .doc(plaidItemId);
}

export async function getPlaidAccessToken(uid: string, plaidItemId: string) {
  const snapshot = await privateItemRef(uid, plaidItemId).get();
  if (!snapshot.exists) throw new Error("Plaid connection secret was not found.");
  const secret = snapshot.data() as PlaidItemSecret;
  return decryptPlaidAccessToken(secret.encryptedAccessToken);
}

export async function fetchPlaidSyncUpdates(
  accessToken: string,
  initialCursor?: string | null,
) {
  for (let attempt = 0; attempt < MAX_SYNC_RESTARTS; attempt += 1) {
    const added: PlaidTransactionPayload[] = [];
    const modified: PlaidTransactionPayload[] = [];
    const removed: Array<{ transaction_id: string }> = [];
    let cursor = initialCursor ?? undefined;
    try {
      do {
        const response = await plaidRequest<PlaidSyncResponse>(
          "transactions/sync",
          {
            access_token: accessToken,
            ...(cursor ? { cursor } : {}),
            options: {
              include_original_description: true,
              personal_finance_category_version: "v2",
            },
          },
        );
        added.push(...response.added);
        modified.push(...response.modified);
        removed.push(...response.removed);
        cursor = response.next_cursor;
        if (!response.has_more) {
          return { added, modified, removed, nextCursor: cursor ?? "" };
        }
      } while (true);
    } catch (error) {
      if (
        error instanceof PlaidApiError &&
        error.errorCode === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" &&
        attempt < MAX_SYNC_RESTARTS - 1
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Plaid transaction synchronization could not stabilize.");
}

function preserveUserClassification(
  incoming: Transaction,
  existing?: Transaction | null,
) {
  if (!existing) return incoming;
  const manuallyControlled =
    existing.classificationLocked ||
    existing.categorizationSource === "manual" ||
    existing.type === "transfer";
  if (!manuallyControlled) return incoming;
  const providerChanged =
    existing.amount !== incoming.amount ||
    existing.date !== incoming.date ||
    existing.postingStatus !== incoming.postingStatus;
  return {
    ...incoming,
    description: existing.description,
    category: existing.category,
    categoryId: existing.categoryId,
    envelopeId: existing.envelopeId,
    transferId: existing.transferId,
    transferDirection: existing.transferDirection,
    transferPurpose: existing.transferPurpose,
    relatedEnvelopeId: existing.relatedEnvelopeId,
    linkedTransactionId: existing.linkedTransactionId,
    type: existing.type,
    categorizationStatus: providerChanged
      ? "needs-review" as const
      : existing.categorizationStatus,
    categorizationSource: existing.categorizationSource,
    categorizationRuleId: existing.categorizationRuleId,
    classificationLocked: existing.classificationLocked,
    categorizedAt: existing.categorizedAt,
    reviewedAt: existing.reviewedAt,
  };
}

function inheritPendingClassification(
  incoming: Transaction,
  pending?: Transaction | null,
) {
  if (!pending) return incoming;
  if (
    !pending.classificationLocked &&
    pending.categorizationSource !== "manual" &&
    !pending.categoryId
  ) {
    return incoming;
  }
  return preserveUserClassification(incoming, pending);
}

export async function rebuildServerAggregates(uid: string, years: Set<number>) {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
  const transactionsRef = userRef(uid).collection("transactions");
  const summariesRef = userRef(uid).collection("financialSummaries");
  for (const year of years) {
    const start = new Date(year, 0, 1).toISOString();
    const end = new Date(year, 11, 31, 23, 59, 59, 999).toISOString();
    const snapshot = await transactionsRef
      .where("date", ">=", start)
      .where("date", "<=", end)
      .get();
    const transactions = snapshot.docs.map(
      (document) => ({ ...document.data(), id: document.id }) as Transaction,
    );
    const accountIds = new Set(
      transactions
        .map((transaction) => transaction.accountId)
        .filter((accountId): accountId is string => Boolean(accountId)),
    );
    const documents = [
      ...buildFinancialAggregateDocuments(transactions, year),
      ...[...accountIds].flatMap((accountId) =>
        buildFinancialAggregateDocuments(transactions, year, accountId),
      ),
    ];
    for (let index = 0; index < documents.length; index += 400) {
      const batch = adminDb.batch();
      documents.slice(index, index + 400).forEach((summary) => {
        batch.set(summariesRef.doc(summary.id), summary);
      });
      await batch.commit();
    }
  }
}

export async function removePlaidItemData({
  uid,
  plaidItemId,
}: {
  uid: string;
  plaidItemId: string;
}) {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
  const user = userRef(uid);
  const [transactionsSnapshot, accountsSnapshot, balanceSnapshot] =
    await Promise.all([
      user
        .collection("transactions")
        .where("providerItemId", "==", plaidItemId)
        .get(),
      user.collection("accounts").where("plaidItemId", "==", plaidItemId).get(),
      user
        .collection("balanceSnapshots")
        .where("plaidItemId", "==", plaidItemId)
        .get(),
    ]);
  const affectedYears = new Set<number>();
  const references = [
    ...transactionsSnapshot.docs.flatMap((document) => {
      const transaction = document.data() as Transaction;
      const year = new Date(transaction.date).getFullYear();
      if (Number.isFinite(year)) affectedYears.add(year);
      return [
        document.ref,
        user.collection("envelopeEvents").doc(`transaction-${document.id}`),
      ];
    }),
    ...balanceSnapshot.docs.map((document) => document.ref),
  ];
  for (let index = 0; index < references.length; index += 450) {
    const batch = adminDb.batch();
    references.slice(index, index + 450).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
  for (let index = 0; index < accountsSnapshot.docs.length; index += 150) {
    const batch = adminDb.batch();
    accountsSnapshot.docs.slice(index, index + 150).forEach((document) => {
      batch.set(
        document.ref,
        {
          plaidItemId: FieldValue.delete(),
          plaidAccountId: FieldValue.delete(),
          institutionId: FieldValue.delete(),
          institutionName: FieldValue.delete(),
          institutionCurrentBalance: FieldValue.delete(),
          institutionAvailableBalance: FieldValue.delete(),
          institutionCreditLimit: FieldValue.delete(),
          institutionBalanceUpdatedAt: FieldValue.delete(),
          institutionBalanceIsRealtime: FieldValue.delete(),
          plaidConnectionStatus: "disconnected",
        },
        { merge: true },
      );
    });
    await batch.commit();
  }
  if (affectedYears.size > 0) await rebuildServerAggregates(uid, affectedYears);
  return {
    deletedTransactions: transactionsSnapshot.size,
    unlinkedAccounts: accountsSnapshot.size,
  };
}

export async function refreshPlaidBalances({
  uid,
  plaidItemId,
  realtime = false,
}: {
  uid: string;
  plaidItemId: string;
  realtime?: boolean;
}) {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
  const accessToken = await getPlaidAccessToken(uid, plaidItemId);
  const response = await plaidRequest<PlaidAccountsResponse>(
    realtime ? "accounts/balance/get" : "accounts/get",
    { access_token: accessToken },
  );
  const accountsSnapshot = await userRef(uid)
    .collection("accounts")
    .where("plaidItemId", "==", plaidItemId)
    .get();
  const byProviderId = new Map(
    accountsSnapshot.docs.map((document) => [
      (document.data() as Account).plaidAccountId,
      document,
    ]),
  );
  const recordedAt = new Date().toISOString();
  const batch = adminDb.batch();
  let updated = 0;
  for (const account of response.accounts) {
    const mappedDocument = byProviderId.get(account.account_id);
    if (!mappedDocument) continue;
    updated += 1;
    batch.set(
      mappedDocument.ref,
      {
        institutionCurrentBalance: account.balances.current ?? null,
        institutionAvailableBalance: account.balances.available ?? null,
        institutionCreditLimit: account.balances.limit ?? null,
        institutionBalanceUpdatedAt: recordedAt,
        institutionBalanceIsRealtime: realtime,
        plaidConnectionStatus: "healthy",
      },
      { merge: true },
    );
    const snapshotId = `${mappedDocument.id}-${createHash("sha256")
      .update(recordedAt)
      .digest("hex")
      .slice(0, 16)}`;
    batch.set(userRef(uid).collection("balanceSnapshots").doc(snapshotId), {
      id: snapshotId,
      accountId: mappedDocument.id,
      plaidItemId,
      currentBalance: account.balances.current ?? null,
      availableBalance: account.balances.available ?? null,
      creditLimit: account.balances.limit ?? null,
      isRealtime: realtime,
      recordedAt,
    });
  }
  batch.set(
    userRef(uid).collection("plaidItems").doc(plaidItemId),
    {
      status: "healthy",
      lastBalanceUpdate: recordedAt,
      consentExpiresAt: response.item?.consent_expiration_time ?? null,
      updatedAt: recordedAt,
    },
    { merge: true },
  );
  await batch.commit();
  return { updated, recordedAt, realtime };
}

async function estimateOpeningBalances(uid: string, plaidItemId: string) {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
  const accountsSnapshot = await userRef(uid)
    .collection("accounts")
    .where("plaidItemId", "==", plaidItemId)
    .get();
  const transactionsSnapshot = await userRef(uid)
    .collection("transactions")
    .where("providerItemId", "==", plaidItemId)
    .get();
  const transactions = transactionsSnapshot.docs.map(
    (document) => ({ ...document.data(), id: document.id }) as Transaction,
  );
  const batch = adminDb.batch();
  let changed = 0;
  for (const accountDocument of accountsSnapshot.docs) {
    const account = { ...accountDocument.data(), id: accountDocument.id } as Account;
    if (!account.openingBalanceEstimated) continue;
    if (account.institutionCurrentBalance === null || account.institutionCurrentBalance === undefined) {
      continue;
    }
    const signedInstitutionBalance =
      account.classification === "liability"
        ? -Math.abs(account.institutionCurrentBalance)
        : account.institutionCurrentBalance;
    const activity = transactions
      .filter((transaction) => transaction.accountId === account.id)
      .reduce(
        (total, transaction) =>
          total + transactionBalanceDelta(transaction),
        0,
      );
    batch.set(
      accountDocument.ref,
      {
        openingBalance: signedInstitutionBalance - activity,
        openingBalanceEstimated: true,
      },
      { merge: true },
    );
    changed += 1;
  }
  if (changed > 0) await batch.commit();
}

export async function syncPlaidItem({
  uid,
  plaidItemId,
  reason,
}: {
  uid: string;
  plaidItemId: string;
  reason: "initial" | "webhook" | "manual" | "scheduled";
}) {
  if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
  const itemRef = userRef(uid).collection("plaidItems").doc(plaidItemId);
  const leaseId = createHash("sha256")
    .update(`${uid}:${plaidItemId}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 24);
  const now = new Date();
  await adminDb.runTransaction(async (transaction) => {
    const item = await transaction.get(itemRef);
    if (!item.exists) throw new Error("Plaid connection was not found.");
    const leaseExpiresAt = item.data()?.syncLeaseExpiresAt as Timestamp | undefined;
    if (leaseExpiresAt && leaseExpiresAt.toMillis() > now.getTime()) {
      throw new Error("This institution is already syncing.");
    }
    transaction.set(
      itemRef,
      {
        status: "syncing",
        syncLeaseId: leaseId,
        syncLeaseExpiresAt: Timestamp.fromMillis(now.getTime() + 5 * 60_000),
        updatedAt: now.toISOString(),
      },
      { merge: true },
    );
  });

  try {
    const [itemSnapshot, rulesSnapshot, accountsSnapshot, settingsSnapshot] =
      await Promise.all([
        itemRef.get(),
        userRef(uid).collection("categorizationRules").where("enabled", "==", true).get(),
        userRef(uid).collection("accounts").where("plaidItemId", "==", plaidItemId).get(),
        userRef(uid).collection("settings").doc("main").get(),
      ]);
    const item = itemSnapshot.data() ?? {};
    const accessToken = await getPlaidAccessToken(uid, plaidItemId);
    const rules = rulesSnapshot.docs.map(
      (document) => ({ ...document.data(), id: document.id }) as CategorizationRule,
    );
    const accountByProviderId = new Map(
      accountsSnapshot.docs
        .map(
          (document) =>
            ({ ...document.data(), id: document.id }) as Account,
        )
        .filter((account) => account.plaidAccountId)
        .map((account) => [account.plaidAccountId!, account.id]),
    );
    const updates = await fetchPlaidSyncUpdates(
      accessToken,
      typeof item.syncCursor === "string" ? item.syncCursor : undefined,
    );
    const transactionsRef = userRef(uid).collection("transactions");
    const envelopeEventsRef = userRef(uid).collection("envelopeEvents");
    const primaryAccountId = settingsSnapshot.data()?.primaryAccountId as
      | string
      | undefined;
    const providerUpdates = [...updates.added, ...updates.modified].filter(
      (transaction) => accountByProviderId.has(transaction.account_id),
    );
    const idsToLoad = new Set<string>();
    providerUpdates.forEach((transaction) => {
      idsToLoad.add(
        stablePlaidTransactionDocumentId(plaidItemId, transaction.transaction_id),
      );
      if (transaction.pending_transaction_id) {
        idsToLoad.add(
          stablePlaidTransactionDocumentId(
            plaidItemId,
            transaction.pending_transaction_id,
          ),
        );
      }
    });
    updates.removed.forEach((removed) =>
      idsToLoad.add(
        stablePlaidTransactionDocumentId(plaidItemId, removed.transaction_id),
      ),
    );
    const existingSnapshots = await Promise.all(
      [...idsToLoad].map((id) => transactionsRef.doc(id).get()),
    );
    const existingById = new Map(
      existingSnapshots
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) => [
          snapshot.id,
          { ...snapshot.data(), id: snapshot.id } as Transaction,
        ]),
    );
    const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
    const affectedYears = new Set<number>();
    const syncedAt = new Date().toISOString();

    for (const providerTransaction of providerUpdates) {
      const accountId = accountByProviderId.get(providerTransaction.account_id)!;
      const documentId = stablePlaidTransactionDocumentId(
        plaidItemId,
        providerTransaction.transaction_id,
      );
      const pendingId = providerTransaction.pending_transaction_id
        ? stablePlaidTransactionDocumentId(
            plaidItemId,
            providerTransaction.pending_transaction_id,
          )
        : undefined;
      let next = normalizePlaidTransaction({
        plaidItemId,
        accountId,
        transaction: providerTransaction,
        rules,
        now: syncedAt,
      });
      next = inheritPendingClassification(
        preserveUserClassification(next, existingById.get(documentId)),
        pendingId ? existingById.get(pendingId) : undefined,
      );
      operations.push((batch) => {
        batch.set(
          transactionsRef.doc(documentId),
          withoutUndefined(next),
          { merge: true },
        );
        const event =
          next.postingStatus === "posted"
            ? envelopeEventForTransaction(next, primaryAccountId)
            : null;
        const eventRef = envelopeEventsRef.doc(`transaction-${documentId}`);
        if (event) batch.set(eventRef, event, { merge: true });
        else batch.delete(eventRef);
        if (pendingId && pendingId !== documentId) {
          batch.delete(transactionsRef.doc(pendingId));
          batch.delete(envelopeEventsRef.doc(`transaction-${pendingId}`));
        }
      });
      const year = new Date(next.date).getFullYear();
      if (Number.isFinite(year)) affectedYears.add(year);
    }

    for (const removed of updates.removed) {
      const documentId = stablePlaidTransactionDocumentId(
        plaidItemId,
        removed.transaction_id,
      );
      const existing = existingById.get(documentId);
      if (!existing) continue;
      operations.push((batch) => {
        if (existing.postingStatus === "pending" && !existing.classificationLocked) {
          batch.delete(transactionsRef.doc(documentId));
        } else {
          batch.set(
            transactionsRef.doc(documentId),
            {
              postingStatus: "removed",
              providerRemovedAt: syncedAt,
              categorizationStatus: "needs-review",
              providerLastSyncedAt: syncedAt,
            },
            { merge: true },
          );
        }
        batch.delete(envelopeEventsRef.doc(`transaction-${documentId}`));
      });
      const year = new Date(existing.date).getFullYear();
      if (Number.isFinite(year)) affectedYears.add(year);
    }

    for (let index = 0; index < operations.length; index += WRITE_CHUNK_SIZE) {
      const batch = adminDb.batch();
      operations
        .slice(index, index + WRITE_CHUNK_SIZE)
        .forEach((operation) => operation(batch));
      await batch.commit();
    }

    await refreshPlaidBalances({ uid, plaidItemId, realtime: false });
    await estimateOpeningBalances(uid, plaidItemId);
    if (affectedYears.size > 0) {
      await rebuildServerAggregates(uid, affectedYears);
    }
    await itemRef.set(
      {
        status: "healthy",
        syncCursor: updates.nextCursor,
        lastSuccessfulSync: syncedAt,
        lastSyncReason: reason,
        errorCode: null,
        errorMessage: null,
        syncLeaseId: FieldValue.delete(),
        syncLeaseExpiresAt: FieldValue.delete(),
        updatedAt: syncedAt,
      },
      { merge: true },
    );
    return {
      added: updates.added.length,
      modified: updates.modified.length,
      removed: updates.removed.length,
      affectedYears: [...affectedYears],
      completedAt: syncedAt,
    };
  } catch (error) {
    const plaidError = error instanceof PlaidApiError ? error : null;
    const attentionCodes = new Set([
      "ITEM_LOGIN_REQUIRED",
      "PENDING_EXPIRATION",
      "PENDING_DISCONNECT",
    ]);
    const status: PlaidItemStatus =
      plaidError?.errorCode && attentionCodes.has(plaidError.errorCode)
        ? "needs-attention"
        : "delayed";
    await itemRef.set(
      {
        status,
        errorCode: plaidError?.errorCode ?? "SYNC_FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Synchronization failed.",
        syncLeaseId: FieldValue.delete(),
        syncLeaseExpiresAt: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    throw error;
  }
}
