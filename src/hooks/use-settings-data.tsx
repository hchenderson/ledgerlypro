"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";

import { useAuth } from "@/hooks/use-auth";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { db } from "@/lib/firebase";

export interface SettingsDataContextType {
  startingBalance: number;
  loading: boolean;
  error: Error | null;
  updateStartingBalance: (balance: number) => Promise<void>;
  clearAllData: () => Promise<void>;
}

const SettingsDataContext =
  createContext<SettingsDataContextType | null>(null);

export function SettingsDataProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const { user } = useAuth();
  const [startingBalance, setStartingBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(
    null,
  );
  const subscriptionUserId = user && enabled ? user.uid : null;

  useEffect(() => {
    if (!user || !enabled) {
      setStartingBalance(0);
      setLoading(false);
      setError(null);
      setLoadedUserId(null);
      return;
    }

    setLoading(true);
    setError(null);
    return onSnapshot(
      doc(db, "users", user.uid, "settings", "main"),
      (snapshot) => {
        setStartingBalance(snapshot.data()?.startingBalance ?? 0);
        setLoading(false);
        setLoadedUserId(user.uid);
      },
      (snapshotError) => {
        console.error("Error fetching financial settings:", snapshotError);
        setError(
          snapshotError instanceof Error
            ? snapshotError
            : new Error("Unable to load financial settings."),
        );
        setLoading(false);
        setLoadedUserId(user.uid);
      },
    );
  }, [enabled, user]);

  const updateStartingBalance = useCallback(
    async (balance: number) => {
      if (!user) throw new Error("User not authenticated");
      await setDoc(
        doc(db, "users", user.uid, "settings", "main"),
        { startingBalance: balance },
        { merge: true },
      );
    },
    [user],
  );

  const clearAllData = useCallback(async () => {
    if (!user) throw new Error("User not authenticated");
    const response = await authenticatedFetch(user, "/api/account/clear-data", {
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Ledger data could not be cleared.");
  }, [user]);

  const value = useMemo<SettingsDataContextType>(
    () => ({
      startingBalance,
      loading:
        subscriptionUserId !== null &&
        (loading || loadedUserId !== subscriptionUserId),
      error,
      updateStartingBalance,
      clearAllData,
    }),
    [
      clearAllData,
      error,
      loadedUserId,
      loading,
      startingBalance,
      subscriptionUserId,
      updateStartingBalance,
    ],
  );

  return (
    <SettingsDataContext.Provider value={value}>
      {children}
    </SettingsDataContext.Provider>
  );
}

export function useSettingsData(): SettingsDataContextType {
  const context = useContext(SettingsDataContext);
  if (!context) {
    throw new Error(
      "useSettingsData must be used within SettingsDataProvider",
    );
  }
  return context;
}
