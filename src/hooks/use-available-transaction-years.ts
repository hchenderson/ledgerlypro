"use client";

import { useEffect, useMemo, useState } from "react";
import { limit, onSnapshot, orderBy, query } from "firebase/firestore";

import { useAuth } from "@/hooks/use-auth";
import { userCollectionRef } from "@/hooks/use-firestore-user-collection";

function transactionYear(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const year = new Date(value).getFullYear();
  return Number.isInteger(year) ? year : null;
}

export function useAvailableTransactionYears() {
  const { user, activeYear, firstYear } = useAuth();
  const currentYear = new Date().getFullYear();
  const [earliestYear, setEarliestYear] = useState<number | null>(null);
  const [latestYear, setLatestYear] = useState<number | null>(null);
  const [earliestLoaded, setEarliestLoaded] = useState(false);
  const [latestLoaded, setLatestLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setEarliestYear(null);
      setLatestYear(null);
      setEarliestLoaded(true);
      setLatestLoaded(true);
      setError(null);
      return;
    }

    setEarliestLoaded(false);
    setLatestLoaded(false);
    setError(null);
    const transactions = userCollectionRef(user.uid, "transactions");
    const handleError = (snapshotError: Error) => {
      setError(snapshotError);
      setEarliestLoaded(true);
      setLatestLoaded(true);
    };
    const unsubscribeEarliest = onSnapshot(
      query(transactions, orderBy("date", "asc"), limit(1)),
      (snapshot) => {
        setEarliestYear(transactionYear(snapshot.docs[0]?.data().date));
        setEarliestLoaded(true);
      },
      handleError,
    );
    const unsubscribeLatest = onSnapshot(
      query(transactions, orderBy("date", "desc"), limit(1)),
      (snapshot) => {
        setLatestYear(transactionYear(snapshot.docs[0]?.data().date));
        setLatestLoaded(true);
      },
      handleError,
    );
    return () => {
      unsubscribeEarliest();
      unsubscribeLatest();
    };
  }, [user]);

  const years = useMemo(() => {
    const oldest = Math.min(firstYear, earliestYear ?? currentYear, activeYear);
    const newest = Math.max(currentYear, latestYear ?? currentYear, activeYear);
    return Array.from(
      { length: newest - oldest + 1 },
      (_, index) => newest - index,
    );
  }, [activeYear, currentYear, earliestYear, firstYear, latestYear]);

  return {
    years,
    earliestYear: Math.min(firstYear, earliestYear ?? currentYear),
    loading: !earliestLoaded || !latestLoaded,
    error,
  };
}
