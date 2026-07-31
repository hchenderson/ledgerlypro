"use client";

import { useCallback, useMemo } from "react";
import { doc, setDoc } from "firebase/firestore";

import { useFirestoreUserCollection } from "@/hooks/use-firestore-user-collection";
import type { AccountReconciliation } from "@/types";

type NewAccountReconciliation = Omit<
  AccountReconciliation,
  "id" | "createdAt"
>;

export function useAccountReconciliations(accountId?: string) {
  const {
    items,
    loading,
    error,
    collectionRef,
  } =
    useFirestoreUserCollection<AccountReconciliation>(
      "accountReconciliations",
    );

  const reconciliations = useMemo(
    () =>
      items
        .filter(
          (reconciliation) =>
            !accountId || reconciliation.accountId === accountId,
        )
        .sort(
          (left, right) =>
            right.statementDate.localeCompare(left.statementDate) ||
            right.createdAt.localeCompare(left.createdAt),
        ),
    [accountId, items],
  );

  const saveReconciliation = useCallback(
    async (
      values: NewAccountReconciliation,
    ): Promise<AccountReconciliation> => {
      if (!collectionRef) {
        throw new Error("User not authenticated");
      }
      if (
        !values.accountId ||
        !values.statementDate ||
        !Number.isFinite(values.statementBalance) ||
        !Number.isFinite(values.ledgerBalance) ||
        !Number.isFinite(values.difference)
      ) {
        throw new Error("The reconciliation details are incomplete.");
      }

      const reconciliationRef = doc(collectionRef);
      const reconciliation: AccountReconciliation = {
        ...values,
        id: reconciliationRef.id,
        createdAt: new Date().toISOString(),
      };
      await setDoc(reconciliationRef, reconciliation);
      return reconciliation;
    },
    [collectionRef],
  );

  return {
    reconciliations,
    loading,
    error,
    saveReconciliation,
  };
}
