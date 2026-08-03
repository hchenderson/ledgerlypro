"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { deleteDoc, deleteField, doc, setDoc } from "firebase/firestore";
import { format } from "date-fns";

import { useAuth } from "@/hooks/use-auth";
import { useFirestoreUserCollection } from "@/hooks/use-firestore-user-collection";
import type { RecurringTransaction } from "@/types";

export interface RecurringSyncState {
  status: "idle" | "syncing" | "success" | "error";
  message?: string;
  lastSyncedAt?: Date;
}

export interface RecurringTransactionsContextType {
  recurringTransactions: RecurringTransaction[];
  loading: boolean;
  error: Error | null;
  recurringSync: RecurringSyncState;
  syncRecurringTransactions: () => Promise<void>;
  addRecurringTransaction: (
    transaction: Omit<RecurringTransaction, "id">,
  ) => Promise<void>;
  updateRecurringTransaction: (
    id: string,
    values: Partial<Omit<RecurringTransaction, "id">>,
  ) => Promise<void>;
  deleteRecurringTransaction: (id: string) => Promise<void>;
}

const RecurringTransactionsContext =
  createContext<RecurringTransactionsContextType | null>(null);

function withoutUndefinedValues<T extends Record<string, unknown>>(values: T) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
}

function withDeletedUndefinedValues<T extends Record<string, unknown>>(
  values: T,
) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      value === undefined ? deleteField() : value,
    ]),
  );
}

export function RecurringTransactionsProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const { user, activeYear } = useAuth();
  const {
    items: recurringTransactions,
    loading,
    error,
    collectionRef,
  } =
    useFirestoreUserCollection<RecurringTransaction>(
      "recurringTransactions",
      { enabled },
    );
  const [recurringSync, setRecurringSync] =
    useState<RecurringSyncState>({ status: "idle" });
  const processingRef = useRef(false);
  const lastAutomaticSyncKeyRef = useRef<string | null>(null);

  const syncRecurringTransactions = useCallback(async () => {
    const systemYear = new Date().getFullYear();
    if (activeYear !== systemYear) {
      setRecurringSync({
        status: "error",
        message: "Switch to the current year to sync schedules.",
      });
      return;
    }
    if (!user) throw new Error("User not authenticated");
    if (processingRef.current) return;

    if (recurringTransactions.length === 0) {
      setRecurringSync({
        status: "success",
        message: "No recurring schedules need processing.",
        lastSyncedAt: new Date(),
      });
      return;
    }

    processingRef.current = true;
    setRecurringSync({
      status: "syncing",
      message: "Checking scheduled transactions…",
    });
    try {
      let totalUpserted = 0;
      let hasMore = false;
      for (let batchNumber = 0; batchNumber < 3; batchNumber += 1) {
        const idToken = await user.getIdToken();
        const response = await fetch("/api/recurring/process", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const result = (await response.json()) as {
          hasMore?: boolean;
          upserted?: number;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(
            result.error ?? "Recurring transaction processing failed",
          );
        }
        totalUpserted += result.upserted ?? 0;
        hasMore = Boolean(result.hasMore);
        if (!result.hasMore) break;
      }

      setRecurringSync({
        status: "success",
        message: hasMore
          ? `${totalUpserted} scheduled transactions added. More remain; select Sync now again.`
          : totalUpserted > 0
            ? `${totalUpserted} scheduled transaction${totalUpserted === 1 ? "" : "s"} added.`
            : "Recurring transactions are up to date.",
        lastSyncedAt: new Date(),
      });
    } catch (syncError) {
      console.error(
        "Error processing recurring transactions:",
        syncError,
      );
      setRecurringSync({
        status: "error",
        message:
          syncError instanceof Error
            ? syncError.message
            : "Recurring sync failed.",
      });
      throw syncError;
    } finally {
      processingRef.current = false;
    }
  }, [activeYear, recurringTransactions.length, user]);

  useEffect(() => {
    if (
      !user ||
      loading ||
      activeYear !== new Date().getFullYear() ||
      recurringTransactions.length === 0
    ) {
      return;
    }

    const automaticSyncKey = [
      user.uid,
      format(new Date(), "yyyy-MM-dd"),
      recurringTransactions.length,
    ].join(":");
    if (lastAutomaticSyncKeyRef.current === automaticSyncKey) return;
    lastAutomaticSyncKeyRef.current = automaticSyncKey;
    void syncRecurringTransactions().catch(() => undefined);
  }, [
    activeYear,
    loading,
    recurringTransactions.length,
    syncRecurringTransactions,
    user,
  ]);

  const addRecurringTransaction = useCallback(
    async (
      transaction: Omit<RecurringTransaction, "id">,
    ) => {
      if (!collectionRef) return;
      const newDocumentRef = doc(collectionRef);
      await setDoc(newDocumentRef, {
        ...withoutUndefinedValues(transaction),
        id: newDocumentRef.id,
        lastAddedDate: null,
      });
    },
    [collectionRef],
  );

  const updateRecurringTransaction = useCallback(
    async (
      id: string,
      values: Partial<Omit<RecurringTransaction, "id">>,
    ) => {
      if (!collectionRef) return;
      await setDoc(
        doc(collectionRef, id),
        withDeletedUndefinedValues(values),
        { merge: true },
      );
    },
    [collectionRef],
  );

  const deleteRecurringTransaction = useCallback(
    async (id: string) => {
      if (!collectionRef) return;
      await deleteDoc(doc(collectionRef, id));
    },
    [collectionRef],
  );

  const value = useMemo<RecurringTransactionsContextType>(
    () => ({
      recurringTransactions,
      loading,
      error,
      recurringSync,
      syncRecurringTransactions,
      addRecurringTransaction,
      updateRecurringTransaction,
      deleteRecurringTransaction,
    }),
    [
      addRecurringTransaction,
      deleteRecurringTransaction,
      error,
      loading,
      recurringSync,
      recurringTransactions,
      syncRecurringTransactions,
      updateRecurringTransaction,
    ],
  );

  return (
    <RecurringTransactionsContext.Provider value={value}>
      {children}
    </RecurringTransactionsContext.Provider>
  );
}

export function useRecurringTransactions(): RecurringTransactionsContextType {
  const context = useContext(RecurringTransactionsContext);
  if (!context) {
    throw new Error(
      "useRecurringTransactions must be used within RecurringTransactionsProvider",
    );
  }
  return context;
}
