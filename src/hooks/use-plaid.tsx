"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useFirestoreUserCollection } from "@/hooks/use-firestore-user-collection";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import type { AccountRole, PlaidItem } from "@/types";

export interface PlaidAccountMapping {
  plaidAccountId: string;
  action: "create" | "existing" | "ignore";
  accountId?: string;
  role?: AccountRole;
}

interface PlaidConfig {
  configured: boolean;
  environment: "sandbox" | "production";
  realTimeBalanceEnabled: boolean;
}

async function responseJson(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "The bank request failed.",
    );
  }
  return payload;
}

export function usePlaid() {
  const { user } = useAuth();
  const { items, loading, error } =
    useFirestoreUserCollection<PlaidItem>("plaidItems");
  const [config, setConfig] = useState<PlaidConfig | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/plaid/config", { cache: "no-store" })
      .then((response) => responseJson(response))
      .then((payload) => {
        if (active) setConfig(payload as unknown as PlaidConfig);
      })
      .catch(() => {
        if (active) {
          setConfig({ configured: false, environment: "sandbox", realTimeBalanceEnabled: false });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const post = useCallback(
    async (path: string, body: Record<string, unknown> = {}) => {
      if (!user) throw new Error("Sign in before connecting an institution.");
      const response = await authenticatedFetch(user, path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      return responseJson(response);
    },
    [user],
  );

  return {
    userUid: user?.uid ?? null,
    items: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    loading,
    error,
    config,
    createLinkToken: async (plaidItemId?: string) => {
      const payload = await post(
        plaidItemId ? "/api/plaid/update-link-token" : "/api/plaid/link-token",
        plaidItemId ? { plaidItemId } : {},
      );
      return String(payload.linkToken);
    },
    exchangePublicToken: async (
      publicToken: string,
      institution?: { institution_id?: string; name?: string },
    ) => {
      const payload = await post("/api/plaid/exchange", {
        publicToken,
        institution,
      });
      return payload.item as unknown as PlaidItem;
    },
    mapAccounts: async (
      plaidItemId: string,
      mappings: PlaidAccountMapping[],
    ) => post("/api/plaid/accounts/map", { plaidItemId, mappings, historyScope: "available" }),
    sync: (plaidItemId: string) => post("/api/plaid/sync", { plaidItemId }),
    refreshBalances: (plaidItemId: string, realtime = false) =>
      post("/api/plaid/balance", { plaidItemId, realtime }),
    disconnect: (plaidItemId: string, deleteImportedData: boolean) =>
      post("/api/plaid/disconnect", { plaidItemId, deleteImportedData }),
  };
}
