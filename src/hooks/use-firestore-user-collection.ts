"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  type CollectionReference,
  type DocumentData,
} from "firebase/firestore";

import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";

export interface UserCollectionResult<T> {
  items: T[];
  loading: boolean;
  error: Error | null;
  collectionRef: CollectionReference<DocumentData> | null;
}

export function userCollectionRef(
  uid: string,
  collectionName: string,
): CollectionReference<DocumentData> {
  return collection(db, "users", uid, collectionName);
}

export function useFirestoreUserCollection<T extends { id: string }>(
  collectionName: string,
  { enabled = true }: { enabled?: boolean } = {},
): UserCollectionResult<T> {
  const { user } = useAuth();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [loadedSubscriptionKey, setLoadedSubscriptionKey] =
    useState<string | null>(null);
  const subscriptionKey =
    user && enabled ? `${user.uid}:${collectionName}` : null;
  const collectionRef = useMemo(
    () => (user ? userCollectionRef(user.uid, collectionName) : null),
    [collectionName, user],
  );

  useEffect(() => {
    if (!collectionRef || !enabled) {
      setItems([]);
      setLoading(false);
      setError(null);
      setLoadedSubscriptionKey(null);
      return;
    }

    setLoading(true);
    setError(null);
    return onSnapshot(
      query(collectionRef),
      (snapshot) => {
        setItems(
          snapshot.docs.map(
            (document) =>
              ({
                ...document.data(),
                id: document.id,
              }) as T,
          ),
        );
        setLoading(false);
        setLoadedSubscriptionKey(subscriptionKey);
      },
      (snapshotError) => {
        console.error(
          `Error fetching ${collectionName}:`,
          snapshotError,
        );
        setError(
          snapshotError instanceof Error
            ? snapshotError
            : new Error(`Unable to load ${collectionName}.`),
        );
        setLoading(false);
        setLoadedSubscriptionKey(subscriptionKey);
      },
    );
  }, [collectionName, collectionRef, enabled, subscriptionKey]);

  return {
    items,
    loading:
      subscriptionKey !== null &&
      (loading || loadedSubscriptionKey !== subscriptionKey),
    error,
    collectionRef,
  };
}
