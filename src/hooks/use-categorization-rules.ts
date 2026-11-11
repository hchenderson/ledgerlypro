"use client";

import { useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useFirestoreUserCollection } from "@/hooks/use-firestore-user-collection";
import type { CategorizationRule } from "@/types";

type RuleInput = Omit<CategorizationRule, "id" | "createdAt" | "updatedAt">;

export function useCategorizationRules() {
  const { user } = useAuth();
  const { items, loading, error, collectionRef } =
    useFirestoreUserCollection<CategorizationRule>("categorizationRules");

  const addRule = useCallback(
    async (values: RuleInput) => {
      if (!user || !collectionRef) throw new Error("Sign in to create a rule.");
      const response = await authenticatedFetch(user, "/api/categorization/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", values }),
      });
      const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error ?? "Rule could not be created.");
      const now = new Date().toISOString();
      return { ...values, id: payload.id, createdAt: now, updatedAt: now };
    },
    [collectionRef, user],
  );

  const updateRule = useCallback(
    async (id: string, values: Partial<RuleInput>) => {
      if (!user || !collectionRef) throw new Error("Sign in to update a rule.");
      const response = await authenticatedFetch(user, "/api/categorization/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update", ruleId: id, values }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Rule could not be updated.");
    },
    [collectionRef, user],
  );

  const deleteRule = useCallback(
    async (id: string) => {
      if (!user || !collectionRef) throw new Error("Sign in to delete a rule.");
      const response = await authenticatedFetch(user, "/api/categorization/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", ruleId: id }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Rule could not be deleted.");
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
