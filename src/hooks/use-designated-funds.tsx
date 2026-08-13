"use client";

import { useCallback } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";

import {
  useFirestoreUserCollection,
} from "@/hooks/use-firestore-user-collection";
import type { DesignatedFund } from "@/types";

export type NewDesignatedFund = Omit<
  DesignatedFund,
  "id" | "createdAt" | "updatedAt" | "isArchived"
>;

export function useDesignatedFunds() {
  const { items, loading, error, collectionRef } =
    useFirestoreUserCollection<DesignatedFund>("designatedFunds");
  const funds = items
    .filter((fund) => !fund.isArchived)
    .sort((left, right) => left.name.localeCompare(right.name));

  const validateCategories = useCallback(
    (values: NewDesignatedFund, editingId?: string) => {
      const selected = new Set([
        ...values.incomeCategoryIds,
        ...values.expenseCategoryIds,
      ]);
      const conflict = items.find(
        (fund) =>
          fund.id !== editingId &&
          !fund.isArchived &&
          [...fund.incomeCategoryIds, ...fund.expenseCategoryIds].some(
            (categoryId) => selected.has(categoryId),
          ),
      );
      if (conflict) {
        throw new Error(
          `One of those categories already belongs to ${conflict.name}. Each category can belong to only one designated fund.`,
        );
      }
    },
    [items],
  );

  const addFund = useCallback(
    async (values: NewDesignatedFund) => {
      if (!collectionRef) throw new Error("User not authenticated");
      validateCategories(values);
      const ref = doc(collectionRef);
      const now = new Date().toISOString();
      await setDoc(ref, {
        ...values,
        id: ref.id,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      } satisfies DesignatedFund);
    },
    [collectionRef, validateCategories],
  );

  const updateFund = useCallback(
    async (id: string, values: NewDesignatedFund) => {
      if (!collectionRef) throw new Error("User not authenticated");
      validateCategories(values, id);
      await setDoc(
        doc(collectionRef, id),
        { ...values, updatedAt: new Date().toISOString() },
        { merge: true },
      );
    },
    [collectionRef, validateCategories],
  );

  const deleteFund = useCallback(
    async (id: string) => {
      if (!collectionRef) throw new Error("User not authenticated");
      await deleteDoc(doc(collectionRef, id));
    },
    [collectionRef],
  );

  return { funds, loading, error, addFund, updateFund, deleteFund };
}
