"use client";

import { useCallback } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";

import { useAuth } from "@/hooks/use-auth";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useFirestoreUserCollection } from "@/hooks/use-firestore-user-collection";
import { db } from "@/lib/firebase";
import type { CategorizationRule } from "@/types";

type RuleInput = Omit<CategorizationRule, "id" | "createdAt" | "updatedAt">;

export function useCategorizationRules() {
  const { user } = useAuth();
  const { items, loading, error, collectionRef } =
    useFirestoreUserCollection<CategorizationRule>("categorizationRules");

  const addRule = useCallback(
    async (values: RuleInput) => {
      if (!user || !collectionRef) throw new Error("Sign in to create a rule.");
      const reference = doc(collectionRef);
      const now = new Date().toISOString();
      const rule: CategorizationRule = {
        ...values,
        id: reference.id,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(reference, rule);
      await setDoc(
        doc(db, "users", user.uid, "categorizationAudit", `rule-created-${reference.id}`),
        { id: `rule-created-${reference.id}`, type: "rule-created", ruleId: reference.id, createdAt: now },
      );
      return rule;
    },
    [collectionRef, user],
  );

  const updateRule = useCallback(
    async (id: string, values: Partial<RuleInput>) => {
      if (!user || !collectionRef) throw new Error("Sign in to update a rule.");
      const now = new Date().toISOString();
      await setDoc(doc(collectionRef, id), { ...values, updatedAt: now }, { merge: true });
      await setDoc(
        doc(db, "users", user.uid, "categorizationAudit", `rule-updated-${id}-${Date.now()}`),
        { type: "rule-updated", ruleId: id, createdAt: now },
      );
    },
    [collectionRef, user],
  );

  const deleteRule = useCallback(
    async (id: string) => {
      if (!user || !collectionRef) throw new Error("Sign in to delete a rule.");
      const now = new Date().toISOString();
      await deleteDoc(doc(collectionRef, id));
      await setDoc(
        doc(db, "users", user.uid, "categorizationAudit", `rule-deleted-${id}-${Date.now()}`),
        { type: "rule-deleted", ruleId: id, createdAt: now },
      );
    },
    [collectionRef, user],
  );

  const applyRules = useCallback(async () => {
    if (!user) throw new Error("Sign in to apply rules.");
    const response = await authenticatedFetch(user, "/api/categorization/apply", {
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Rules could not be applied.");
    return payload;
  }, [user]);

  return {
    rules: items.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name)),
    loading,
    error,
    addRule,
    updateRule,
    deleteRule,
    applyRules,
  };
}
