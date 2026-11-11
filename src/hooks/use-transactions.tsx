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
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { endOfYear, startOfYear } from "date-fns";
import type { User } from "firebase/auth";

import { useAuth } from "@/hooks/use-auth";
import { useAccounts } from "@/hooks/use-accounts";
import { db } from "@/lib/firebase";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { chunkArray } from "@/lib/batching";
import {
  FINANCIAL_AGGREGATE_VERSION,
  buildFinancialAggregateDocuments,
  financialAggregateId,
  type FinancialAggregateDocument,
} from "@/lib/financial-aggregates";
import {
  prepareTransactionImport,
  type TransactionImportSummary,
} from "@/lib/transaction-import";
import type { FinancialDateRange } from "@/lib/financial-summary";
import type { Envelope, EnvelopeEvent, Transaction } from "@/types";
import {
  buildTransferTransactions,
  calculateAccountBalance,
  type TransferInput,
} from "@/lib/accounts";
import {
  calculateEnvelopeSummary,
  envelopeEventForTransaction,
  envelopeEventsForTransfer,
} from "@/lib/envelopes";
import {
  allocationsAreComplete,
  canonicalizeTransactionMoney,
} from "@/lib/transaction-allocations";
import { transactionLedgerDate } from "@/lib/ledger-date";
import { canonicalMoneyFields, moneyMinor } from "@/lib/money";

interface TransactionQueryResult {
  transactions: Transaction[];
  loading: boolean;
  error: Error | null;
}

export interface TransactionDataContextType extends TransactionQueryResult {
  addTransaction: (transaction: Omit<Transaction, "id">) => Promise<void>;
  importTransactions: (
    transactions: Omit<Transaction, "id">[],
  ) => Promise<TransactionImportSummary>;
  updateTransaction: (
    id: string,
    values: Partial<Omit<Transaction, "id">>,
  ) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  clearTransactions: () => Promise<void>;
  clearTransactionsByDateRange: (
    startDate: Date,
    endDate: Date,
  ) => Promise<void>;
  addTransfer: (transfer: TransferInput) => Promise<void>;
  linkTransactionsAsTransfer: (input: {
    outgoingTransactionId: string;
    incomingTransactionId: string;
    description?: string;
    purpose?: TransferInput["purpose"];
    envelopeId?: string;
    relatedEnvelopeId?: string;
  }) => Promise<void>;
}

interface TransactionQueryOptions {
  enabled?: boolean;
  respectAccountFilter?: boolean;
}

const TransactionDataContext =
  createContext<TransactionDataContextType | null>(null);

function transactionCollection(uid: string) {
  return collection(db, "users", uid, "transactions");
}

function envelopeEventCollection(uid: string) {
  return collection(db, "users", uid, "envelopeEvents");
}

function transactionFromSnapshot(
  snapshot: { id: string; data: () => unknown },
  reportingTimeZone?: string,
): Transaction {
  const transaction = {
    ...(snapshot.data() as Omit<Transaction, "id">),
    id: snapshot.id,
  };
  const ledgerDate = transactionLedgerDate(transaction, reportingTimeZone);
  return {
    ...transaction,
    date: ledgerDate,
    ledgerDate,
  };
}

function rangeToLedgerBounds(range: FinancialDateRange) {
  const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { from: key(range.from), to: key(range.to) };
}

export function yearTransactionRange(year: number): FinancialDateRange {
  const date = new Date(year, 0, 1);
  return {
    from: startOfYear(date),
    to: endOfYear(date),
  };
}

export function useTransactionRange(
  range: FinancialDateRange | undefined,
  {
    enabled = true,
    respectAccountFilter = true,
  }: TransactionQueryOptions = {},
): TransactionQueryResult {
  const { user, reportingTimeZone } = useAuth();
  const { filterTransactions } = useAccounts();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const fromTime = range?.from.getTime();
  const toTime = range?.to.getTime();

  useEffect(() => {
    if (!user || !enabled || fromTime === undefined || toTime === undefined) {
      setTransactions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const bounds = rangeToLedgerBounds({
      from: new Date(fromTime),
      to: new Date(toTime),
    });
    setLoading(true);
    setError(null);

    return onSnapshot(
      query(transactionCollection(user.uid), orderBy("date", "desc")),
      (snapshot) => {
        const nextTransactions = snapshot.docs
          .map((document) => transactionFromSnapshot(document, reportingTimeZone))
          .filter((transaction) => transaction.ledgerDate! >= bounds.from && transaction.ledgerDate! <= bounds.to);
        setTransactions(
          respectAccountFilter
            ? filterTransactions(nextTransactions)
            : nextTransactions,
        );
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Error loading transaction range:", snapshotError);
        setError(
          snapshotError instanceof Error
            ? snapshotError
            : new Error("Unable to load transactions."),
        );
        setLoading(false);
      },
    );
  }, [
    enabled,
    filterTransactions,
    fromTime,
    respectAccountFilter,
    reportingTimeZone,
    toTime,
    user,
  ]);

  return { transactions, loading, error };
}

export function useTransactionsForYear(
  year: number,
  options?: TransactionQueryOptions,
): TransactionQueryResult {
  const range = useMemo(() => yearTransactionRange(year), [year]);
  return useTransactionRange(range, options);
}

export function useTransactionsForYears(
  years: number[],
  {
    enabled = true,
    respectAccountFilter = true,
  }: TransactionQueryOptions = {},
): TransactionQueryResult {
  const { user, reportingTimeZone } = useAuth();
  const { filterTransactions } = useAccounts();
  const normalizedYears = useMemo(
    () => [...new Set(years)].filter(Number.isFinite).sort(),
    [years],
  );
  const yearsKey = normalizedYears.join(",");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user || !enabled || normalizedYears.length === 0) {
      setTransactions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    return onSnapshot(
      query(transactionCollection(user.uid), orderBy("date", "desc")),
      (snapshot) => {
        const yearSet = new Set(normalizedYears);
        const nextTransactions = snapshot.docs
          .map((document) => transactionFromSnapshot(document, reportingTimeZone))
          .filter((transaction) => yearSet.has(Number(transaction.ledgerDate!.slice(0, 4))))
          .sort((left, right) => right.ledgerDate!.localeCompare(left.ledgerDate!));
        setTransactions(respectAccountFilter ? filterTransactions(nextTransactions) : nextTransactions);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        console.error("Error loading transactions for selected years:", snapshotError);
        setError(snapshotError instanceof Error ? snapshotError : new Error("Unable to load selected years."));
        setLoading(false);
      },
    );
    // yearsKey is the stable subscription identity; normalizedYears is recreated
    // only when that identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    filterTransactions,
    respectAccountFilter,
    reportingTimeZone,
    user,
    yearsKey,
  ]);

  return { transactions, loading, error };
}

export function useAllTransactions(
  {
    enabled = true,
    respectAccountFilter = true,
  }: TransactionQueryOptions = {},
): TransactionQueryResult {
  const { user, reportingTimeZone } = useAuth();
  const { filterTransactions } = useAccounts();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user || !enabled) {
      setTransactions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    return onSnapshot(
      query(transactionCollection(user.uid), orderBy("date", "desc")),
      (snapshot) => {
        const nextTransactions = snapshot.docs.map((document) =>
          transactionFromSnapshot(document, reportingTimeZone),
        );
        setTransactions(
          respectAccountFilter
            ? filterTransactions(nextTransactions)
            : nextTransactions,
        );
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        console.error("Error loading all transactions:", snapshotError);
        setError(
          snapshotError instanceof Error
            ? snapshotError
            : new Error("Unable to load transaction history."),
        );
        setLoading(false);
      },
    );
  }, [
    enabled,
    filterTransactions,
    respectAccountFilter,
    reportingTimeZone,
    user,
  ]);

  return { transactions, loading, error };
}

export function useFinancialAggregate(
  year: number,
  month?: number,
): {
  summary: FinancialAggregateDocument | null;
  loading: boolean;
  error: Error | null;
} {
  const { user } = useAuth();
  const [summary, setSummary] =
    useState<FinancialAggregateDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    return onSnapshot(
      doc(
        db,
        "users",
        user.uid,
        "financialSummaries",
        financialAggregateId(year, month),
      ),
      (snapshot) => {
        setSummary(
          snapshot.exists()
            ? (snapshot.data() as FinancialAggregateDocument)
            : null,
        );
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        console.error("Error loading financial summary:", snapshotError);
        setError(
          snapshotError instanceof Error
            ? snapshotError
            : new Error("Unable to load financial summary."),
        );
        setLoading(false);
      },
    );
  }, [month, user, year]);

  return { summary, loading, error };
}

export function usePriorYearsNet(
  activeYear: number,
  firstYear: number,
): {
  net: number;
  loading: boolean;
  error: Error | null;
} {
  const { user, reportingTimeZone } = useAuth();
  const {
    allAccountsSelected,
    selectedAccountIds,
  } = useAccounts();
  const [summaries, setSummaries] = useState<FinancialAggregateDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const backfillKey = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    return onSnapshot(
      query(
        collection(db, "users", user.uid, "financialSummaries"),
        where("period", "==", "year"),
      ),
      (snapshot) => {
        setSummaries(
          snapshot.docs.map(
            (summary) => summary.data() as FinancialAggregateDocument,
          ),
        );
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        console.error("Error loading yearly summaries:", snapshotError);
        setError(
          snapshotError instanceof Error
            ? snapshotError
            : new Error("Unable to load yearly summaries."),
        );
        setLoading(false);
      },
    );
  }, [user]);

  useEffect(() => {
    if (!user || loading || error) return;
    const oldestYear = Math.min(firstYear, activeYear);
    const expectedYears = Array.from(
      { length: Math.max(0, activeYear - oldestYear) },
      (_, index) => oldestYear + index,
    );
    const summarizedYears = new Set(
      summaries
        .filter(
          (summary) =>
            !summary.accountId &&
            summary.version >= FINANCIAL_AGGREGATE_VERSION,
        )
        .map((summary) => summary.year),
    );
    const missingYears = expectedYears.filter(
      (year) => !summarizedYears.has(year),
    );
    const nextBackfillKey = `${user.uid}:${missingYears.join(",")}`;

    if (missingYears.length === 0) {
      setBackfilling(false);
      backfillKey.current = null;
      return;
    }
    if (backfillKey.current === nextBackfillKey) return;

    backfillKey.current = nextBackfillKey;
    setBackfilling(true);
    void (async () => {
      try {
        for (const year of missingYears) {
          await rebuildFinancialSummariesForYear(user, year);
        }
      } catch (backfillError) {
        console.error("Unable to backfill yearly summaries:", backfillError);
        setError(
          backfillError instanceof Error
            ? backfillError
            : new Error("Unable to prepare yearly summaries."),
        );
      } finally {
        setBackfilling(false);
      }
    })();
  }, [activeYear, error, firstYear, loading, reportingTimeZone, summaries, user]);

  const net = useMemo(() => {
    const priorSummaries = summaries.filter(
      (summary) => summary.year < activeYear,
    );
    if (allAccountsSelected) {
      return priorSummaries
        .filter((summary) => !summary.accountId)
        .reduce((total, summary) => total + summary.net, 0);
    }

    return priorSummaries
      .filter(
        (summary) =>
          summary.accountId &&
          selectedAccountIds.includes(summary.accountId),
      )
      .reduce(
        (total, summary) =>
          total + (summary.balanceChange ?? summary.net),
        0,
      );
  }, [
    activeYear,
    allAccountsSelected,
    selectedAccountIds,
    summaries,
  ]);

  return { net, loading: loading || backfilling, error };
}

export function useTransactionsBeforeYear(
  year: number,
  {
    respectAccountFilter = true,
  }: Pick<TransactionQueryOptions, "respectAccountFilter"> = {},
): TransactionQueryResult {
  const { user, reportingTimeZone } = useAuth();
  const { filterTransactions } = useAccounts();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const upperBound = `${year}-01-01`;
    return onSnapshot(
      query(transactionCollection(user.uid), orderBy("date", "desc")),
      (snapshot) => {
        const nextTransactions = snapshot.docs
          .map((document) => transactionFromSnapshot(document, reportingTimeZone))
          .filter((transaction) => transaction.ledgerDate! < upperBound);
        setTransactions(
          respectAccountFilter
            ? filterTransactions(nextTransactions)
            : nextTransactions,
        );
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        console.error("Error loading prior transactions:", snapshotError);
        setError(
          snapshotError instanceof Error
            ? snapshotError
            : new Error("Unable to load prior transactions."),
        );
        setLoading(false);
      },
    );
  }, [
    filterTransactions,
    respectAccountFilter,
    reportingTimeZone,
    user,
    year,
  ]);

  return { transactions, loading, error };
}

async function rebuildFinancialSummariesForYear(
  user: User,
  year: number,
): Promise<void> {
  const response = await authenticatedFetch(user, "/api/financial-summaries/rebuild", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ year }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Unable to rebuild financial summaries.");
}

export function TransactionDataProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, activeYear, envelopeSettings, reportingTimeZone } = useAuth();
  const {
    primaryAccountId,
    filterTransactions,
    getAccount,
  } = useAccounts();
  const activeYearQuery = useTransactionsForYear(activeYear, {
    respectAccountFilter: false,
  });
  const visibleActiveYearQuery = useMemo<TransactionQueryResult>(
    () => ({
      ...activeYearQuery,
      transactions: filterTransactions(
        activeYearQuery.transactions,
      ),
    }),
    [activeYearQuery, filterTransactions],
  );
  const syncedFingerprint = useRef<string | null>(null);

  useEffect(() => {
    if (!user || activeYearQuery.loading || activeYearQuery.error) return;
    const aggregate = buildFinancialAggregateDocuments(
      activeYearQuery.transactions,
      activeYear,
    )[0];
    const aggregateKey = `${activeYear}:${aggregate.sourceFingerprint}`;
    if (syncedFingerprint.current === aggregateKey) return;
    syncedFingerprint.current = aggregateKey;

    const timeout = window.setTimeout(() => {
      void rebuildFinancialSummariesForYear(user, activeYear).catch((syncError) => {
        syncedFingerprint.current = null;
        console.error("Unable to cache financial summaries:", syncError);
      });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [
    activeYear,
    activeYearQuery.error,
    activeYearQuery.loading,
    activeYearQuery.transactions,
    user,
  ]);

  const rebuildYears = useCallback(
    async (years: Iterable<number>) => {
      if (!user) return;
      for (const year of [...new Set(years)]) {
        await rebuildFinancialSummariesForYear(user, year);
      }
    },
    [user],
  );

  const validateEnvelopeTransfer = useCallback(
    async (
      transfer: Pick<
        TransferInput,
        | "amount"
        | "destinationAccountId"
        | "envelopeId"
        | "purpose"
        | "relatedEnvelopeId"
        | "sourceAccountId"
      >,
    ) => {
      if (!user || !transfer.purpose || transfer.purpose === "ordinary") {
        return;
      }
      if (!transfer.envelopeId) {
        throw new Error("Select an envelope for this transfer.");
      }

      const envelopeSnapshot = await getDoc(
        doc(db, "users", user.uid, "envelopes", transfer.envelopeId),
      );
      if (!envelopeSnapshot.exists()) {
        throw new Error("That envelope is no longer available.");
      }
      const transferEnvelope = {
        ...envelopeSnapshot.data(),
        id: envelopeSnapshot.id,
      } as Envelope;
      if (!transferEnvelope.backingAccountId || transferEnvelope.isArchived) {
        throw new Error("Choose an active account-backed envelope.");
      }

      let relatedEnvelope: Envelope | undefined;
      if (transfer.purpose === "reallocate") {
        if (!transfer.relatedEnvelopeId) {
          throw new Error("Select a destination envelope.");
        }
        const relatedSnapshot = await getDoc(
          doc(
            db,
            "users",
            user.uid,
            "envelopes",
            transfer.relatedEnvelopeId,
          ),
        );
        if (!relatedSnapshot.exists()) {
          throw new Error("The destination envelope is unavailable.");
        }
        relatedEnvelope = {
          ...relatedSnapshot.data(),
          id: relatedSnapshot.id,
        } as Envelope;
        if (
          relatedEnvelope.isArchived ||
          !relatedEnvelope.backingAccountId ||
          relatedEnvelope.id === transferEnvelope.id
        ) {
          throw new Error(
            "Choose a different active account-backed destination envelope.",
          );
        }
      }

      const expectedFromMain =
        transfer.purpose === "fund-envelope" ||
        transfer.purpose === "return-unused";
      const expectedSource = expectedFromMain
        ? primaryAccountId
        : transferEnvelope.backingAccountId;
      const expectedDestination = expectedFromMain
        ? transferEnvelope.backingAccountId
        : transfer.purpose === "reallocate"
          ? relatedEnvelope?.backingAccountId
          : primaryAccountId;
      if (
        transfer.sourceAccountId !== expectedSource ||
        transfer.destinationAccountId !== expectedDestination
      ) {
        throw new Error(
          "The selected accounts do not match this envelope transfer purpose.",
        );
      }

      const eventSnapshot = await getDocs(
        query(
          envelopeEventCollection(user.uid),
          where("envelopeId", "==", transferEnvelope.id),
        ),
      );
      const summary = calculateEnvelopeSummary(
        transferEnvelope,
        eventSnapshot.docs.map(
          (eventDocument) =>
            ({
              ...eventDocument.data(),
              id: eventDocument.id,
            }) as EnvelopeEvent,
        ),
      );
      if (
        ["release-to-spend", "unassign", "reallocate"].includes(
          transfer.purpose,
        ) &&
        Math.abs(transfer.amount) > Math.max(0, summary.available) + 0.004
      ) {
        throw new Error(
          `${transferEnvelope.name} does not have enough available money for this transfer.`,
        );
      }
      if (
        transfer.purpose === "return-unused" &&
        Math.abs(transfer.amount) > summary.reservedInOperating + 0.004
      ) {
        throw new Error(
          `Only ${new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(summary.reservedInOperating)} is currently reserved in Main for ${transferEnvelope.name}.`,
        );
      }
    },
    [primaryAccountId, user],
  );

  const addTransaction = useCallback(
    async (transaction: Omit<Transaction, "id">) => {
      if (!user) throw new Error("User not authenticated");
      if (
        transaction.allocations?.length &&
        !allocationsAreComplete(transaction.amount, transaction.allocations)
      ) {
        throw new Error("Split allocations must equal the transaction amount.");
      }
      const accountId = transaction.accountId ?? primaryAccountId;
      if (!accountId) {
        throw new Error(
          "Create or select an account before adding a transaction.",
        );
      }
      const newDocRef = doc(transactionCollection(user.uid));
      const nextTransaction = canonicalizeTransactionMoney({
        ...transaction,
        ledgerDate: transactionLedgerDate(transaction),
        accountId,
        id: newDocRef.id,
      });
      const event = envelopeEventForTransaction(
        nextTransaction,
        primaryAccountId,
      );
      const batch = writeBatch(db);
      batch.set(newDocRef, nextTransaction);
      if (event) {
        batch.set(
          doc(envelopeEventCollection(user.uid), event.id),
          event,
        );
      }
      await batch.commit();
      const year = Number(nextTransaction.ledgerDate?.slice(0, 4));
      if (Number.isFinite(year) && year !== activeYear) {
        await rebuildYears([year]);
      }
    },
    [activeYear, primaryAccountId, rebuildYears, user],
  );

  const importTransactions = useCallback(
    async (
      importedTransactions: Omit<Transaction, "id">[],
    ): Promise<TransactionImportSummary> => {
      if (!user) throw new Error("User not authenticated");
      const collRef = transactionCollection(user.uid);
      const existingSnapshot = await getDocs(query(collRef, orderBy("date", "desc")));
      const existingTransactions =
        existingSnapshot.docs.map((document) => transactionFromSnapshot(document));
      const transactionsWithAccounts = importedTransactions.map(
        (transaction) => {
          const accountId =
            transaction.accountId ?? primaryAccountId;
          if (!accountId) {
            throw new Error(
              "Select an account before importing transactions.",
            );
          }
          return canonicalizeTransactionMoney({
            ...transaction,
            ledgerDate: transactionLedgerDate(transaction),
            accountId,
            id: "import-validation",
          });
        },
      );
      const prepared = prepareTransactionImport(
        transactionsWithAccounts,
        existingTransactions,
      );

      for (const transactionChunk of chunkArray(prepared.transactions, 225)) {
        const batch = writeBatch(db);
        for (const transaction of transactionChunk) {
          const newDocRef = doc(collRef);
          const nextTransaction: Transaction = {
            ...transaction,
            id: newDocRef.id,
          };
          batch.set(newDocRef, nextTransaction);
          const event = envelopeEventForTransaction(
            nextTransaction,
            primaryAccountId,
          );
          if (event) {
            batch.set(
              doc(envelopeEventCollection(user.uid), event.id),
              event,
            );
          }
        }
        await batch.commit();
      }

      await rebuildYears(
        prepared.transactions
          .map((transaction) => Number(transaction.ledgerDate?.slice(0, 4)))
          .filter(Number.isFinite),
      );

      return {
        imported: prepared.transactions.length,
        duplicates: prepared.duplicates,
      };
    },
    [primaryAccountId, rebuildYears, user],
  );

  const addTransfer = useCallback(
    async (transfer: TransferInput) => {
      if (!user) throw new Error("User not authenticated");
      await validateEnvelopeTransfer(transfer);
      if (
        transfer.purpose === "fund-envelope" &&
        transfer.sourceAccountId === primaryAccountId &&
        envelopeSettings.minimumOperatingBalance > 0
      ) {
        const operatingAccount = getAccount(primaryAccountId ?? undefined);
        if (operatingAccount) {
          const accountSnapshot = await getDocs(
            query(transactionCollection(user.uid)),
          );
          const currentBalance = calculateAccountBalance(
            operatingAccount,
            accountSnapshot.docs.map((document) => transactionFromSnapshot(document)),
          );
          if (
            currentBalance - Math.abs(transfer.amount) <
            envelopeSettings.minimumOperatingBalance
          ) {
            throw new Error(
              `This transfer would move the Main account below its ${new Intl.NumberFormat(
                "en-US",
                { style: "currency", currency: "USD" },
              ).format(envelopeSettings.minimumOperatingBalance)} cushion.`,
            );
          }
        }
      }
      const transactionsRef = transactionCollection(user.uid);
      const outgoingRef = doc(transactionsRef);
      const incomingRef = doc(transactionsRef);
      const transferId = outgoingRef.id;
      const [outgoing, incoming] = buildTransferTransactions({
        input: transfer,
        transferId,
        outgoingId: outgoingRef.id,
        incomingId: incomingRef.id,
      });

      const batch = writeBatch(db);
      batch.set(outgoingRef, outgoing);
      batch.set(incomingRef, incoming);
      envelopeEventsForTransfer({
        transferId,
        envelopeId: transfer.envelopeId,
        relatedEnvelopeId: transfer.relatedEnvelopeId,
        purpose: transfer.purpose,
        amount: transfer.amount,
        date: transfer.date,
        note: transfer.description,
      }).forEach((event) => {
        batch.set(
          doc(envelopeEventCollection(user.uid), event.id),
          event,
        );
      });
      await batch.commit();

      const year = new Date(transfer.date).getFullYear();
      if (Number.isFinite(year) && year !== activeYear) {
        await rebuildYears([year]);
      }
    },
    [
      activeYear,
      envelopeSettings.minimumOperatingBalance,
      getAccount,
      primaryAccountId,
      rebuildYears,
      user,
      validateEnvelopeTransfer,
    ],
  );

  const linkTransactionsAsTransfer = useCallback(
    async ({
      outgoingTransactionId,
      incomingTransactionId,
      description,
      purpose,
      envelopeId,
      relatedEnvelopeId,
    }: {
      outgoingTransactionId: string;
      incomingTransactionId: string;
      description?: string;
      purpose?: TransferInput["purpose"];
      envelopeId?: string;
      relatedEnvelopeId?: string;
    }) => {
      if (!user) throw new Error("User not authenticated");
      if (
        !outgoingTransactionId ||
        !incomingTransactionId ||
        outgoingTransactionId === incomingTransactionId
      ) {
        throw new Error("Choose two different transactions.");
      }

      const transactionsRef = transactionCollection(user.uid);
      const outgoingRef = doc(
        transactionsRef,
        outgoingTransactionId,
      );
      const incomingRef = doc(
        transactionsRef,
        incomingTransactionId,
      );
      const [outgoingSnapshot, incomingSnapshot] =
        await Promise.all([getDoc(outgoingRef), getDoc(incomingRef)]);

      if (!outgoingSnapshot.exists() || !incomingSnapshot.exists()) {
        throw new Error(
          "One of these transactions is no longer available.",
        );
      }

      const outgoing = transactionFromSnapshot(outgoingSnapshot);
      const incoming = transactionFromSnapshot(incomingSnapshot);
      if (
        outgoing.type !== "expense" ||
        incoming.type !== "income"
      ) {
        throw new Error(
          "A transfer match needs one withdrawal and one deposit.",
        );
      }
      if (
        !outgoing.accountId ||
        !incoming.accountId ||
        outgoing.accountId === incoming.accountId
      ) {
        throw new Error(
          "A transfer match must use two different accounts.",
        );
      }
      if (
        moneyMinor(outgoing) !== moneyMinor(incoming)
      ) {
        throw new Error(
          "The withdrawal and deposit amounts no longer match.",
        );
      }

      await validateEnvelopeTransfer({
        amount: outgoing.amount,
        destinationAccountId: incoming.accountId,
        envelopeId,
        purpose,
        relatedEnvelopeId,
        sourceAccountId: outgoing.accountId,
      });

      const transferId = outgoingRef.id;
      const sharedValues = {
        type: "transfer" as const,
        category: "Transfer",
        categoryId: deleteField(),
        transferId,
        transferPurpose: purpose ?? "ordinary",
        envelopeId: envelopeId ?? deleteField(),
        relatedEnvelopeId: relatedEnvelopeId ?? deleteField(),
        ...canonicalMoneyFields(outgoing),
        ...(description?.trim()
          ? { description: description.trim() }
          : {}),
      };
      const batch = writeBatch(db);
      batch.set(
        outgoingRef,
        {
          ...sharedValues,
          transferDirection: "out",
          linkedTransactionId: incomingRef.id,
        },
        { merge: true },
      );
      batch.set(
        incomingRef,
        {
          ...sharedValues,
          transferDirection: "in",
          linkedTransactionId: outgoingRef.id,
        },
        { merge: true },
      );
      batch.delete(
        doc(
          envelopeEventCollection(user.uid),
          `transaction-${outgoingRef.id}`,
        ),
      );
      batch.delete(
        doc(
          envelopeEventCollection(user.uid),
          `transaction-${incomingRef.id}`,
        ),
      );
      envelopeEventsForTransfer({
        transferId,
        envelopeId,
        relatedEnvelopeId,
        purpose,
        amount: outgoing.amount,
        date: outgoing.date,
        note: description ?? outgoing.description,
      }).forEach((event) => {
        batch.set(
          doc(envelopeEventCollection(user.uid), event.id),
          event,
        );
      });
      await batch.commit();

      await rebuildYears(
        [outgoing.date, incoming.date]
          .map((date) => new Date(date).getFullYear())
          .filter(Number.isFinite),
      );
    },
    [rebuildYears, user, validateEnvelopeTransfer],
  );

  const updateTransaction = useCallback(
    async (
      id: string,
      values: Partial<Omit<Transaction, "id">>,
    ) => {
      if (!user) throw new Error("User not authenticated");
      const transactionRef = doc(transactionCollection(user.uid), id);
      const previousSnapshot = await getDoc(transactionRef);
      const previous = previousSnapshot.exists()
        ? (previousSnapshot.data() as Transaction)
        : null;
      const nextAmount = values.amount ?? previous?.amount ?? 0;
      const nextAllocations = values.allocations ?? previous?.allocations;
      if (
        nextAllocations?.length &&
        !allocationsAreComplete(nextAmount, nextAllocations)
      ) {
        throw new Error("Split allocations must equal the transaction amount.");
      }
      if (previous?.type === "transfer" && previous.transferId) {
        const linkedTransferSnapshot = await getDocs(
          query(
            transactionCollection(user.uid),
            where("transferId", "==", previous.transferId),
          ),
        );
        const sharedValues = {
          ...(values.date
            ? { date: values.date, ledgerDate: transactionLedgerDate({ date: values.date }) }
            : {}),
          ...(values.description
            ? { description: values.description }
            : {}),
          ...(values.amount !== undefined || values.amountMinor !== undefined
            ? canonicalMoneyFields({
                amount: values.amount ?? previous.amount,
                amountMinor: values.amountMinor,
                currency: values.currency,
              })
            : {}),
        };
        const batch = writeBatch(db);
        linkedTransferSnapshot.docs.forEach((transferDocument) => {
          batch.set(transferDocument.ref, sharedValues, {
            merge: true,
          });
        });
        const linkedEnvelopeEvents = await getDocs(
          query(
            envelopeEventCollection(user.uid),
            where("transferId", "==", previous.transferId),
          ),
        );
        linkedEnvelopeEvents.docs.forEach((eventDocument) => {
          batch.set(
            eventDocument.ref,
            {
              ...(values.date ? { date: values.date } : {}),
              ...(values.description
                ? { note: values.description }
                : {}),
              ...(values.amount !== undefined
                ? { amount: Math.abs(values.amount) }
                : {}),
            },
            { merge: true },
          );
        });
        await batch.commit();
      } else {
        const canonicalValues =
          values.amount !== undefined || values.amountMinor !== undefined
            ? {
                ...values,
                ...canonicalMoneyFields({
                  amount: values.amount ?? previous?.amount ?? 0,
                  amountMinor: values.amountMinor,
                  currency: values.currency ?? previous?.currency,
                }),
              }
            : values;
        const nextTransaction = canonicalizeTransactionMoney({
          ...previous,
          ...canonicalValues,
          id,
          ledgerDate: transactionLedgerDate({
            date: values.date ?? previous?.date ?? new Date().toISOString(),
            ledgerDate: values.ledgerDate ?? previous?.ledgerDate,
          }),
          accountId:
            values.accountId ??
            previous?.accountId ??
            primaryAccountId ??
            undefined,
        } as Transaction);
        const event = envelopeEventForTransaction(
          nextTransaction,
          primaryAccountId,
        );
        const batch = writeBatch(db);
        batch.set(transactionRef, nextTransaction, { merge: true });
        const eventRef = doc(
          envelopeEventCollection(user.uid),
          `transaction-${id}`,
        );
        if (event) batch.set(eventRef, event);
        else batch.delete(eventRef);
        await batch.commit();
      }
      const years = [
        previous?.date,
        values.date,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => new Date(value).getFullYear())
        .filter(Number.isFinite);
      const nonActiveYears = years.filter((year) => year !== activeYear);
      if (nonActiveYears.length > 0) await rebuildYears(nonActiveYears);
    },
    [activeYear, primaryAccountId, rebuildYears, user],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!user) throw new Error("User not authenticated");
      const transactionRef = doc(transactionCollection(user.uid), id);
      const previousSnapshot = await getDoc(transactionRef);
      const previous = previousSnapshot.exists()
        ? (previousSnapshot.data() as Transaction)
        : null;
      const affectedDates = previous?.date
        ? [previous.date]
        : [];
      if (previous?.type === "transfer" && previous.transferId) {
        const linkedTransferSnapshot = await getDocs(
          query(
            transactionCollection(user.uid),
            where("transferId", "==", previous.transferId),
          ),
        );
        const batch = writeBatch(db);
        linkedTransferSnapshot.docs.forEach((transferDocument) => {
          const transfer = transferDocument.data() as Transaction;
          if (transfer.date) affectedDates.push(transfer.date);
          batch.delete(transferDocument.ref);
        });
        const linkedEnvelopeEvents = await getDocs(
          query(
            envelopeEventCollection(user.uid),
            where("transferId", "==", previous.transferId),
          ),
        );
        linkedEnvelopeEvents.docs.forEach((eventDocument) =>
          batch.delete(eventDocument.ref),
        );
        await batch.commit();
      } else {
        const batch = writeBatch(db);
        batch.delete(transactionRef);
        batch.delete(
          doc(
            envelopeEventCollection(user.uid),
            `transaction-${id}`,
          ),
        );
        await batch.commit();
      }
      const nonActiveYears = affectedDates
        .map((date) => new Date(date).getFullYear())
        .filter(
          (year) =>
            Number.isFinite(year) && year !== activeYear,
        );
      if (nonActiveYears.length > 0) {
        await rebuildYears(nonActiveYears);
      }
    },
    [activeYear, rebuildYears, user],
  );

  const deleteTransactionQuery = useCallback(
    async (...constraints: Parameters<typeof query>[1][]) => {
      if (!user) throw new Error("User not authenticated");
      const snapshot = await getDocs(
        query(transactionCollection(user.uid), ...constraints),
      );
      const affectedYears = new Set<number>();
      for (const documentChunk of chunkArray(snapshot.docs, 90)) {
        const batch = writeBatch(db);
        const transferIds = new Set<string>();
        for (const documentSnapshot of documentChunk) {
          const transaction = transactionFromSnapshot(
            documentSnapshot,
            reportingTimeZone,
          );
          const year = Number(transaction.ledgerDate!.slice(0, 4));
          if (Number.isFinite(year)) affectedYears.add(year);
          batch.delete(documentSnapshot.ref);
          batch.delete(
            doc(
              envelopeEventCollection(user.uid),
              `transaction-${documentSnapshot.id}`,
            ),
          );
          if (transaction.transferId) {
            transferIds.add(transaction.transferId);
          }
        }
        transferIds.forEach((transferId) => {
          batch.delete(
            doc(
              envelopeEventCollection(user.uid),
              `transfer-${transferId}`,
            ),
          );
          batch.delete(
            doc(
              envelopeEventCollection(user.uid),
              `transfer-${transferId}-out`,
            ),
          );
          batch.delete(
            doc(
              envelopeEventCollection(user.uid),
              `transfer-${transferId}-in`,
            ),
          );
        });
        await batch.commit();
      }
      return affectedYears;
    },
    [reportingTimeZone, user],
  );

  const clearTransactions = useCallback(async () => {
    if (!user) throw new Error("User not authenticated");
    const affectedYears = await deleteTransactionQuery();
    await rebuildYears(affectedYears);
  }, [deleteTransactionQuery, rebuildYears, user]);

  const clearTransactionsByDateRange = useCallback(
    async (startDate: Date, endDate: Date) => {
      if (!user) throw new Error("User not authenticated");
      const bounds = rangeToLedgerBounds({ from: startDate, to: endDate });
      const transactionsRef = transactionCollection(user.uid);
      const allSnapshot = await getDocs(query(transactionsRef, orderBy("date", "desc")));
      const rangeDocuments = allSnapshot.docs.filter((documentSnapshot) => {
        const item = transactionFromSnapshot(documentSnapshot, reportingTimeZone);
        return item.ledgerDate! >= bounds.from && item.ledgerDate! <= bounds.to;
      });

      const documentsToDelete = new Map(
        rangeDocuments.map((documentSnapshot) => [
          documentSnapshot.id,
          documentSnapshot,
        ]),
      );
      const linkedIds = [
        ...new Set(
          rangeDocuments
            .map(
              (documentSnapshot) =>
                (
                  documentSnapshot.data() as Transaction
                ).linkedTransactionId,
            )
            .filter(
              (linkedId): linkedId is string =>
                typeof linkedId === "string" &&
                !documentsToDelete.has(linkedId),
            ),
        ),
      ];
      const linkedSnapshots = await Promise.all(
        linkedIds.map((linkedId) =>
          getDoc(doc(transactionsRef, linkedId)),
        ),
      );
      linkedSnapshots.forEach((linkedSnapshot) => {
        if (linkedSnapshot.exists()) {
          documentsToDelete.set(
            linkedSnapshot.id,
            linkedSnapshot,
          );
        }
      });

      const affectedYears = new Set<number>();
      for (const documentSnapshot of documentsToDelete.values()) {
        const item = transactionFromSnapshot(documentSnapshot, reportingTimeZone);
        const year = Number(item.ledgerDate!.slice(0, 4));
        if (Number.isFinite(year)) affectedYears.add(year);
      }

      for (const documentChunk of chunkArray(
        [...documentsToDelete.values()],
        90,
      )) {
        const batch = writeBatch(db);
        const transferIds = new Set<string>();
        documentChunk.forEach((documentSnapshot) => {
          batch.delete(documentSnapshot.ref);
          batch.delete(
            doc(
              envelopeEventCollection(user.uid),
              `transaction-${documentSnapshot.id}`,
            ),
          );
          const transaction = documentSnapshot.data() as Transaction;
          if (transaction.transferId) {
            transferIds.add(transaction.transferId);
          }
        });
        transferIds.forEach((transferId) => {
          batch.delete(
            doc(
              envelopeEventCollection(user.uid),
              `transfer-${transferId}`,
            ),
          );
          batch.delete(
            doc(
              envelopeEventCollection(user.uid),
              `transfer-${transferId}-out`,
            ),
          );
          batch.delete(
            doc(
              envelopeEventCollection(user.uid),
              `transfer-${transferId}-in`,
            ),
          );
        });
        await batch.commit();
      }

      await rebuildYears(affectedYears);
    },
    [rebuildYears, reportingTimeZone, user],
  );

  const value = useMemo<TransactionDataContextType>(
    () => ({
      ...visibleActiveYearQuery,
      addTransaction,
      addTransfer,
      linkTransactionsAsTransfer,
      importTransactions,
      updateTransaction,
      deleteTransaction,
      clearTransactions,
      clearTransactionsByDateRange,
    }),
    [
      visibleActiveYearQuery,
      addTransaction,
      addTransfer,
      linkTransactionsAsTransfer,
      clearTransactions,
      clearTransactionsByDateRange,
      deleteTransaction,
      importTransactions,
      updateTransaction,
    ],
  );

  return (
    <TransactionDataContext.Provider value={value}>
      {children}
    </TransactionDataContext.Provider>
  );
}

export function useTransactionData(): TransactionDataContextType {
  const context = useContext(TransactionDataContext);
  if (!context) {
    throw new Error(
      "useTransactionData must be used within a TransactionDataProvider",
    );
  }
  return context;
}
