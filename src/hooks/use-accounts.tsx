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
import {
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { useAuth } from "@/hooks/use-auth";
import {
  useFirestoreUserCollection,
  userCollectionRef,
} from "@/hooks/use-firestore-user-collection";
import {
  PRIMARY_ACCOUNT_ID,
  accountClassificationForType,
} from "@/lib/accounts";
import { chunkArray } from "@/lib/batching";
import { db } from "@/lib/firebase";
import type { Account, Transaction } from "@/types";

type NewAccount = Omit<
  Account,
  | "id"
  | "classification"
  | "currency"
  | "createdAt"
  | "isArchived"
  | "isDefault"
>;

type AccountUpdates = Partial<
  Omit<
    Account,
    | "id"
    | "classification"
    | "currency"
    | "createdAt"
    | "isDefault"
  >
>;

export interface AccountsContextType {
  accounts: Account[];
  activeAccounts: Account[];
  primaryAccountId: string | null;
  selectedAccountIds: string[];
  allAccountsSelected: boolean;
  openingBalanceForSelection: number;
  loading: boolean;
  error: Error | null;
  addAccount: (account: NewAccount) => Promise<Account>;
  updateAccount: (id: string, values: AccountUpdates) => Promise<void>;
  archiveAccount: (id: string) => Promise<void>;
  restoreAccount: (id: string) => Promise<void>;
  setSelectedAccountIds: (ids: string[]) => void;
  toggleAccountSelection: (id: string) => void;
  selectAllAccounts: () => void;
  getAccount: (id?: string) => Account | undefined;
  getAccountName: (id?: string) => string;
  filterTransactions: (
    transactions: Transaction[],
  ) => Transaction[];
}

const AccountsContext = createContext<AccountsContextType | null>(
  null,
);

const selectionStorageKey = (uid: string) =>
  `ledgerly-account-selection:${uid}`;

async function assignDefaultAccount(
  uid: string,
  collectionName: "transactions" | "recurringTransactions",
  accountId: string,
) {
  const snapshot = await getDocs(
    query(userCollectionRef(uid, collectionName)),
  );
  const missingAccount = snapshot.docs.filter(
    (document) => !document.data().accountId,
  );

  for (const documentChunk of chunkArray(missingAccount, 450)) {
    const batch = writeBatch(db);
    documentChunk.forEach((document) => {
      batch.update(document.ref, { accountId });
    });
    await batch.commit();
  }
}

export function AccountsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const {
    items: accounts,
    loading: accountsLoading,
    error: accountsError,
    collectionRef,
  } = useFirestoreUserCollection<Account>("accounts");
  const [migrationLoading, setMigrationLoading] = useState(true);
  const [migrationError, setMigrationError] =
    useState<Error | null>(null);
  const migrationUserRef = useRef<string | null>(null);
  const [selectedAccountIdsState, setSelectedAccountIdsState] =
    useState<string[]>([]);
  const [selectionHydratedFor, setSelectionHydratedFor] =
    useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      migrationUserRef.current = null;
      setMigrationLoading(false);
      setMigrationError(null);
      return;
    }
    if (
      accountsLoading ||
      migrationUserRef.current === user.uid
    ) {
      return;
    }

    migrationUserRef.current = user.uid;
    setMigrationLoading(true);
    setMigrationError(null);

    const migrate = async () => {
      const settingsRef = doc(
        db,
        "users",
        user.uid,
        "settings",
        "main",
      );
      const settingsSnapshot = await getDoc(settingsRef);
      const settings = settingsSnapshot.data() ?? {};

      let primaryAccount =
        accounts.find((account) => account.isDefault) ??
        accounts.find((account) => !account.isArchived) ??
        accounts[0];

      if (!primaryAccount) {
        primaryAccount = {
          id: PRIMARY_ACCOUNT_ID,
          name: "Primary Account",
          type: "checking",
          classification: "asset",
          openingBalance: Number(settings.startingBalance) || 0,
          currency: "USD",
          isDefault: true,
          isArchived: false,
          createdAt: new Date().toISOString(),
        };
        await setDoc(
          doc(
            userCollectionRef(user.uid, "accounts"),
            primaryAccount.id,
          ),
          primaryAccount,
        );
      } else if (!primaryAccount.isDefault) {
        await setDoc(
          doc(
            userCollectionRef(user.uid, "accounts"),
            primaryAccount.id,
          ),
          { isDefault: true },
          { merge: true },
        );
      }

      if ((settings.accountSchemaVersion ?? 0) < 1) {
        await Promise.all([
          assignDefaultAccount(
            user.uid,
            "transactions",
            primaryAccount.id,
          ),
          assignDefaultAccount(
            user.uid,
            "recurringTransactions",
            primaryAccount.id,
          ),
        ]);
        await setDoc(
          settingsRef,
          {
            accountSchemaVersion: 1,
            primaryAccountId: primaryAccount.id,
          },
          { merge: true },
        );
      }
    };

    void migrate()
      .catch((error) => {
        migrationUserRef.current = null;
        const normalizedError =
          error instanceof Error
            ? error
            : new Error("Unable to prepare accounts.");
        setMigrationError(normalizedError);
        console.error("Account migration failed:", error);
      })
      .finally(() => setMigrationLoading(false));
  }, [accounts, accountsLoading, user]);

  useEffect(() => {
    if (!user) {
      setSelectedAccountIdsState([]);
      setSelectionHydratedFor(null);
      return;
    }
    try {
      const saved = window.localStorage.getItem(
        selectionStorageKey(user.uid),
      );
      const parsed = saved ? JSON.parse(saved) : [];
      setSelectedAccountIdsState(
        Array.isArray(parsed)
          ? parsed.filter(
              (value): value is string =>
                typeof value === "string",
            )
          : [],
      );
    } catch {
      setSelectedAccountIdsState([]);
    }
    setSelectionHydratedFor(user.uid);
  }, [user]);

  const validSelectedAccountIds = useMemo(() => {
    const accountIds = new Set(accounts.map((account) => account.id));
    return selectedAccountIdsState.filter((id) =>
      accountIds.has(id),
    );
  }, [accounts, selectedAccountIdsState]);

  useEffect(() => {
    if (
      !user ||
      selectionHydratedFor !== user.uid ||
      accountsLoading
    ) {
      return;
    }
    window.localStorage.setItem(
      selectionStorageKey(user.uid),
      JSON.stringify(validSelectedAccountIds),
    );
    if (
      validSelectedAccountIds.length !==
      selectedAccountIdsState.length
    ) {
      setSelectedAccountIdsState(validSelectedAccountIds);
    }
  }, [
    accountsLoading,
    selectedAccountIdsState.length,
    selectionHydratedFor,
    user,
    validSelectedAccountIds,
  ]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => !account.isArchived),
    [accounts],
  );
  const primaryAccountId =
    accounts.find((account) => account.isDefault)?.id ??
    activeAccounts[0]?.id ??
    accounts[0]?.id ??
    null;
  const allAccountsSelected = validSelectedAccountIds.length === 0;

  const setSelectedAccountIds = useCallback((ids: string[]) => {
    setSelectedAccountIdsState([...new Set(ids)]);
  }, []);

  const toggleAccountSelection = useCallback((id: string) => {
    setSelectedAccountIdsState((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id],
    );
  }, []);

  const selectAllAccounts = useCallback(() => {
    setSelectedAccountIdsState([]);
  }, []);

  const getAccount = useCallback(
    (id?: string) =>
      id ? accounts.find((account) => account.id === id) : undefined,
    [accounts],
  );

  const getAccountName = useCallback(
    (id?: string) =>
      getAccount(id)?.name ??
      (id ? "Unknown account" : "Primary Account"),
    [getAccount],
  );

  const filterTransactions = useCallback(
    (transactions: Transaction[]) => {
      if (validSelectedAccountIds.length === 0) return transactions;
      return transactions.filter((transaction) =>
        validSelectedAccountIds.includes(
          transaction.accountId ?? primaryAccountId ?? "",
        ),
      );
    },
    [primaryAccountId, validSelectedAccountIds],
  );

  const openingBalanceForSelection = useMemo(() => {
    const included =
      validSelectedAccountIds.length === 0
        ? accounts
        : accounts.filter((account) =>
            validSelectedAccountIds.includes(account.id),
          );
    return included.reduce(
      (total, account) => total + account.openingBalance,
      0,
    );
  }, [accounts, validSelectedAccountIds]);

  const addAccount = useCallback(
    async (account: NewAccount): Promise<Account> => {
      if (!collectionRef) throw new Error("User not authenticated");
      const newDocumentRef = doc(collectionRef);
      const newAccount: Account = {
        ...account,
        id: newDocumentRef.id,
        classification: accountClassificationForType(account.type),
        currency: "USD",
        isArchived: false,
        createdAt: new Date().toISOString(),
      };
      await setDoc(newDocumentRef, newAccount);
      return newAccount;
    },
    [collectionRef],
  );

  const updateAccount = useCallback(
    async (id: string, values: AccountUpdates) => {
      if (!collectionRef) throw new Error("User not authenticated");
      const nextValues = values.type
        ? {
            ...values,
            classification: accountClassificationForType(values.type),
          }
        : values;
      await setDoc(doc(collectionRef, id), nextValues, {
        merge: true,
      });
    },
    [collectionRef],
  );

  const archiveAccount = useCallback(
    async (id: string) => {
      const account = getAccount(id);
      if (!account) return;
      if (account.isDefault) {
        throw new Error("The primary account cannot be archived.");
      }
      if (activeAccounts.length <= 1) {
        throw new Error("At least one active account is required.");
      }
      await updateAccount(id, { isArchived: true });
      setSelectedAccountIdsState((current) =>
        current.filter((candidate) => candidate !== id),
      );
    },
    [activeAccounts.length, getAccount, updateAccount],
  );

  const restoreAccount = useCallback(
    async (id: string) => {
      await updateAccount(id, { isArchived: false });
    },
    [updateAccount],
  );

  const value = useMemo<AccountsContextType>(
    () => ({
      accounts,
      activeAccounts,
      primaryAccountId,
      selectedAccountIds: validSelectedAccountIds,
      allAccountsSelected,
      openingBalanceForSelection,
      loading: accountsLoading || migrationLoading,
      error: accountsError ?? migrationError,
      addAccount,
      updateAccount,
      archiveAccount,
      restoreAccount,
      setSelectedAccountIds,
      toggleAccountSelection,
      selectAllAccounts,
      getAccount,
      getAccountName,
      filterTransactions,
    }),
    [
      accounts,
      accountsError,
      accountsLoading,
      activeAccounts,
      addAccount,
      allAccountsSelected,
      archiveAccount,
      filterTransactions,
      getAccount,
      getAccountName,
      migrationError,
      migrationLoading,
      openingBalanceForSelection,
      primaryAccountId,
      restoreAccount,
      selectAllAccounts,
      setSelectedAccountIds,
      toggleAccountSelection,
      updateAccount,
      validSelectedAccountIds,
    ],
  );

  return (
    <AccountsContext.Provider value={value}>
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts(): AccountsContextType {
  const context = useContext(AccountsContext);
  if (!context) {
    throw new Error(
      "useAccounts must be used within AccountsProvider",
    );
  }
  return context;
}
