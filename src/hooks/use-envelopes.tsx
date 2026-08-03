"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { doc, setDoc, writeBatch } from "firebase/firestore";

import { useAccounts } from "@/hooks/use-accounts";
import { useAuth } from "@/hooks/use-auth";
import { useTransactionData } from "@/hooks/use-transactions";
import {
  useFirestoreUserCollection,
  userCollectionRef,
} from "@/hooks/use-firestore-user-collection";
import {
  calculateEnvelopeSummaries,
  calculatePendingEnvelopeCommitments,
  suggestEnvelopeForTransaction,
  type EnvelopeSummary,
  type EnvelopeSummaryOptions,
} from "@/lib/envelopes";
import { defaultAccountRoleForType } from "@/lib/accounts";
import { db } from "@/lib/firebase";
import type { Envelope, EnvelopeEvent, Transaction } from "@/types";

export type NewEnvelope = Omit<
  Envelope,
  "id" | "createdAt" | "isArchived"
>;

type EnvelopeUpdates = Partial<
  Omit<Envelope, "id" | "createdAt">
>;

export interface EnvelopesContextType {
  envelopes: Envelope[];
  activeEnvelopes: Envelope[];
  events: EnvelopeEvent[];
  loading: boolean;
  error: Error | null;
  addEnvelope: (
    envelope: NewEnvelope,
    startingAllocation?: number,
  ) => Promise<Envelope>;
  updateEnvelope: (
    id: string,
    values: EnvelopeUpdates,
  ) => Promise<void>;
  archiveEnvelope: (id: string) => Promise<void>;
  restoreEnvelope: (id: string) => Promise<void>;
  addAdjustment: (
    envelopeId: string,
    amount: number,
    note?: string,
  ) => Promise<void>;
  getEnvelope: (id?: string | null) => Envelope | undefined;
  getEnvelopeName: (id?: string | null) => string;
  getSummaries: (
    options?: EnvelopeSummaryOptions,
  ) => EnvelopeSummary[];
  suggestEnvelope: (
    transaction: Pick<
      Transaction,
      "accountId" | "categoryId" | "type"
    >,
  ) => Envelope | undefined;
}

const EnvelopesContext = createContext<EnvelopesContextType | null>(
  null,
);

export function EnvelopesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, budgetingMode } = useAuth();
  const { transactions } = useTransactionData();
  const enabled = budgetingMode !== "tracking";
  const { getAccount, primaryAccountId } = useAccounts();
  const {
    items: envelopes,
    loading: envelopesLoading,
    error: envelopesError,
    collectionRef,
  } = useFirestoreUserCollection<Envelope>("envelopes", { enabled });
  const {
    items: events,
    loading: eventsLoading,
    error: eventsError,
  } = useFirestoreUserCollection<EnvelopeEvent>("envelopeEvents", {
    enabled,
  });

  const activeEnvelopes = useMemo(
    () =>
      envelopes
        .filter((envelope) => !envelope.isArchived)
        .sort(
          (left, right) =>
            left.priority - right.priority ||
            left.name.localeCompare(right.name),
        ),
    [envelopes],
  );

  const addEnvelope = useCallback(
    async (
      envelope: NewEnvelope,
      startingAllocation = 0,
    ): Promise<Envelope> => {
      if (!user || !collectionRef) {
        throw new Error("User not authenticated");
      }
      if (
        envelope.backingAccountId &&
        envelopes.some(
          (candidate) =>
            !candidate.isArchived &&
            candidate.backingAccountId === envelope.backingAccountId,
        )
      ) {
        throw new Error(
          "That account already backs another active envelope.",
        );
      }

      const envelopeRef = doc(collectionRef);
      const createdAt = new Date().toISOString();
      const nextEnvelope: Envelope = {
        ...envelope,
        id: envelopeRef.id,
        isArchived: false,
        createdAt,
      };
      const batch = writeBatch(db);
      batch.set(envelopeRef, nextEnvelope);

      if (Math.abs(startingAllocation) > 0.004) {
        const startingRef = doc(
          userCollectionRef(user.uid, "envelopeEvents"),
        );
        const startingEvent: EnvelopeEvent = {
          id: startingRef.id,
          envelopeId: nextEnvelope.id,
          type: "starting-allocation",
          amount: Math.abs(startingAllocation),
          date: createdAt,
          note: "Starting allocation confirmed during setup",
          createdAt,
        };
        batch.set(startingRef, startingEvent);
      }

      if (
        nextEnvelope.backingAccountId &&
        nextEnvelope.backingAccountId !== primaryAccountId
      ) {
        batch.set(
          doc(
            userCollectionRef(user.uid, "accounts"),
            nextEnvelope.backingAccountId,
          ),
          { role: "envelope" },
          { merge: true },
        );
      }
      await batch.commit();
      return nextEnvelope;
    },
    [collectionRef, envelopes, primaryAccountId, user],
  );

  const updateEnvelope = useCallback(
    async (id: string, values: EnvelopeUpdates) => {
      if (!user || !collectionRef) {
        throw new Error("User not authenticated");
      }
      const previous = envelopes.find((envelope) => envelope.id === id);
      if (!previous) throw new Error("That envelope is no longer available.");
      const nextBackingAccountId =
        values.backingAccountId ?? previous.backingAccountId;
      const nextIsArchived = values.isArchived ?? previous.isArchived;
      if (
        !nextIsArchived &&
        nextBackingAccountId &&
        envelopes.some(
          (candidate) =>
            candidate.id !== id &&
            !candidate.isArchived &&
            candidate.backingAccountId === nextBackingAccountId,
        )
      ) {
        throw new Error(
          "That account already backs another active envelope.",
        );
      }
      const batch = writeBatch(db);
      batch.set(doc(collectionRef, id), values, { merge: true });

      if (
        previous.backingAccountId &&
        previous.backingAccountId !== primaryAccountId &&
        (nextIsArchived ||
          previous.backingAccountId !== nextBackingAccountId) &&
        !envelopes.some(
          (candidate) =>
            candidate.id !== id &&
            !candidate.isArchived &&
            candidate.backingAccountId === previous.backingAccountId,
        )
      ) {
        const previousAccount = getAccount(previous.backingAccountId);
        if (previousAccount) {
          batch.set(
            doc(
              userCollectionRef(user.uid, "accounts"),
              previous.backingAccountId,
            ),
            { role: defaultAccountRoleForType(previousAccount.type) },
            { merge: true },
          );
        }
      }
      if (
        !nextIsArchived &&
        nextBackingAccountId &&
        nextBackingAccountId !== primaryAccountId
      ) {
        batch.set(
          doc(
            userCollectionRef(user.uid, "accounts"),
            nextBackingAccountId,
          ),
          { role: "envelope" },
          { merge: true },
        );
      }
      await batch.commit();
    },
    [collectionRef, envelopes, getAccount, primaryAccountId, user],
  );

  const archiveEnvelope = useCallback(
    async (id: string) => {
      await updateEnvelope(id, { isArchived: true });
    },
    [updateEnvelope],
  );

  const restoreEnvelope = useCallback(
    async (id: string) => {
      await updateEnvelope(id, { isArchived: false });
    },
    [updateEnvelope],
  );

  const addAdjustment = useCallback(
    async (envelopeId: string, amount: number, note?: string) => {
      if (!user || !Number.isFinite(amount) || Math.abs(amount) < 0.005) {
        throw new Error("Enter a non-zero adjustment amount.");
      }
      const eventRef = doc(
        userCollectionRef(user.uid, "envelopeEvents"),
      );
      const createdAt = new Date().toISOString();
      const adjustment: EnvelopeEvent = {
        id: eventRef.id,
        envelopeId,
        type: "adjustment",
        amount,
        date: createdAt,
        note: note?.trim() || "Manual envelope adjustment",
        createdAt,
      };
      await setDoc(eventRef, adjustment);
    },
    [user],
  );

  const getEnvelope = useCallback(
    (id?: string | null) =>
      id ? envelopes.find((envelope) => envelope.id === id) : undefined,
    [envelopes],
  );

  const getEnvelopeName = useCallback(
    (id?: string | null) => getEnvelope(id)?.name ?? "No envelope",
    [getEnvelope],
  );

  const getSummaries = useCallback(
    (options: EnvelopeSummaryOptions = {}) =>
      calculateEnvelopeSummaries(activeEnvelopes, events, options).map(
        (summary) => {
          const pendingCommitted = calculatePendingEnvelopeCommitments(
            transactions,
            summary.envelope.id,
            options,
          );
          return {
            ...summary,
            pendingCommitted,
            spendableAvailable: summary.available - pendingCommitted,
          };
        },
      ),
    [activeEnvelopes, events, transactions],
  );

  const suggestEnvelope = useCallback(
    (
      transaction: Pick<
        Transaction,
        "accountId" | "categoryId" | "type"
      >,
    ) => {
      const direct = suggestEnvelopeForTransaction(
        transaction,
        activeEnvelopes,
      );
      if (direct) return direct;
      if (
        transaction.type === "expense" &&
        transaction.accountId === primaryAccountId
      ) {
        return calculateEnvelopeSummaries(activeEnvelopes, events)
          .filter((summary) => summary.reservedInOperating > 0)
          .sort(
            (left, right) =>
              right.reservedInOperating - left.reservedInOperating,
          )[0]?.envelope;
      }
      return undefined;
    },
    [activeEnvelopes, events, primaryAccountId],
  );

  const value = useMemo<EnvelopesContextType>(
    () => ({
      envelopes,
      activeEnvelopes,
      events,
      loading: envelopesLoading || eventsLoading,
      error: envelopesError ?? eventsError,
      addEnvelope,
      updateEnvelope,
      archiveEnvelope,
      restoreEnvelope,
      addAdjustment,
      getEnvelope,
      getEnvelopeName,
      getSummaries,
      suggestEnvelope,
    }),
    [
      activeEnvelopes,
      addAdjustment,
      addEnvelope,
      archiveEnvelope,
      envelopes,
      envelopesError,
      envelopesLoading,
      events,
      eventsError,
      eventsLoading,
      getEnvelope,
      getEnvelopeName,
      getSummaries,
      restoreEnvelope,
      suggestEnvelope,
      updateEnvelope,
    ],
  );

  return (
    <EnvelopesContext.Provider value={value}>
      {children}
    </EnvelopesContext.Provider>
  );
}

export function useEnvelopes(): EnvelopesContextType {
  const context = useContext(EnvelopesContext);
  if (!context) {
    throw new Error("useEnvelopes must be used within EnvelopesProvider");
  }
  return context;
}
