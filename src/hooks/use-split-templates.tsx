"use client";

import { useCallback } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";

import { useFirestoreUserCollection } from "@/hooks/use-firestore-user-collection";
import type { SplitTemplate } from "@/types";

export function useSplitTemplates() {
  const { items, loading, error, collectionRef } =
    useFirestoreUserCollection<SplitTemplate>("splitTemplates");
  const templates = [...items].sort((left, right) => left.name.localeCompare(right.name));

  const addTemplate = useCallback(
    async (values: Omit<SplitTemplate, "id" | "createdAt" | "updatedAt">) => {
      if (!collectionRef) throw new Error("User not authenticated");
      const ref = doc(collectionRef);
      const now = new Date().toISOString();
      await setDoc(ref, { ...values, id: ref.id, createdAt: now, updatedAt: now });
    },
    [collectionRef],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      if (!collectionRef) throw new Error("User not authenticated");
      await deleteDoc(doc(collectionRef, id));
    },
    [collectionRef],
  );

  return { templates, loading, error, addTemplate, deleteTemplate };
}
