import { endOfDay, startOfDay } from "date-fns";

import { calculateAccountBalance } from "@/lib/accounts";
import { isTransactionFinalized } from "@/lib/categorization";
import type {
  Account,
  Envelope,
  EnvelopeEvent,
  Transaction,
  TransferPurpose,
} from "@/types";

export interface EnvelopeSummary {
  envelope: Envelope;
  available: number;
  funded: number;
  spent: number;
  released: number;
  returned: number;
  reservedInOperating: number;
  pendingCommitted: number;
  spendableAvailable: number;
  targetGap: number;
  progress: number;
  status: "healthy" | "underfunded" | "overspent";
}

export interface EnvelopeSummaryOptions {
  from?: Date;
  to?: Date;
}

const cents = (value: number) => Math.round(value * 100) / 100;

function isWithinPeriod(
  event: EnvelopeEvent,
  options: EnvelopeSummaryOptions,
) {
  const time = new Date(event.date).getTime();
  if (!Number.isFinite(time)) return false;
  if (options.from && time < startOfDay(options.from).getTime()) {
    return false;
  }
  if (options.to && time > endOfDay(options.to).getTime()) {
    return false;
  }
  return true;
}

export function envelopeAvailabilityDelta(event: EnvelopeEvent): number {
  const amount = Math.abs(event.amount);
  switch (event.type) {
    case "starting-allocation":
    case "fund":
    case "refund":
    case "reassign-in":
      return amount;
    case "expense":
    case "unassign":
    case "reassign-out":
      return -amount;
    case "adjustment":
      return event.amount;
    case "release":
    case "return":
      return 0;
  }
}

export function calculateEnvelopeSummary(
  envelope: Envelope,
  events: EnvelopeEvent[],
  options: EnvelopeSummaryOptions = {},
): EnvelopeSummary {
  const envelopeEvents = events
    .filter((event) => event.envelopeId === envelope.id)
    .sort(
      (left, right) =>
        new Date(left.date).getTime() - new Date(right.date).getTime() ||
        left.id.localeCompare(right.id),
    );
  const periodEvents = envelopeEvents.filter((event) =>
    isWithinPeriod(event, options),
  );
  const availabilityCutoff = options.to
    ? endOfDay(options.to).getTime()
    : Number.POSITIVE_INFINITY;
  const availabilityEvents = options.to
    ? envelopeEvents.filter(
        (event) =>
          new Date(event.date).getTime() <= availabilityCutoff,
      )
    : envelopeEvents;
  const available = cents(
    availabilityEvents.reduce(
      (total, event) => total + envelopeAvailabilityDelta(event),
      0,
    ),
  );
  const funded = cents(
    periodEvents
      .filter((event) => event.type === "fund")
      .reduce((total, event) => total + Math.abs(event.amount), 0),
  );
  const spent = cents(
    periodEvents
      .filter((event) => event.type === "expense")
      .reduce((total, event) => total + Math.abs(event.amount), 0),
  );
  const released = cents(
    periodEvents
      .filter((event) => event.type === "release")
      .reduce((total, event) => total + Math.abs(event.amount), 0),
  );
  const returned = cents(
    periodEvents
      .filter((event) => event.type === "return")
      .reduce((total, event) => total + Math.abs(event.amount), 0),
  );
  const reservedInOperating = cents(
    Math.max(
      0,
      availabilityEvents.reduce((total, event) => {
        if (event.type === "release") {
          return total + Math.abs(event.amount);
        }
        if (event.type === "return") {
          return total - Math.abs(event.amount);
        }
        if (event.type === "expense" && event.usesReleasedFunds) {
          return total - Math.abs(event.amount);
        }
        if (event.type === "refund" && event.usesReleasedFunds) {
          return total + Math.abs(event.amount);
        }
        return total;
      }, 0),
    ),
  );
  const target = Math.max(0, envelope.targetAmount ?? 0);
  const targetGap = cents(Math.max(0, target - available));
  const progress = target > 0 ? (available / target) * 100 : 0;

  return {
    envelope,
    available,
    funded,
    spent,
    released,
    returned,
    reservedInOperating,
    pendingCommitted: 0,
    spendableAvailable: available,
    targetGap,
    progress,
    status:
      available < 0
        ? "overspent"
        : target > 0 && available < target
          ? "underfunded"
          : "healthy",
  };
}

export function calculatePendingEnvelopeCommitments(
  transactions: Transaction[],
  envelopeId: string,
  options: EnvelopeSummaryOptions = {},
) {
  return cents(
    transactions
      .filter(
        (transaction) =>
          transaction.postingStatus === "pending" &&
          transaction.type === "expense" &&
          transaction.envelopeId === envelopeId &&
          !transaction.providerRemovedAt &&
          (!options.from ||
            new Date(transaction.date).getTime() >=
              startOfDay(options.from).getTime()) &&
          (!options.to ||
            new Date(transaction.date).getTime() <=
              endOfDay(options.to).getTime()),
      )
      .reduce(
        (total, transaction) => total + Math.abs(transaction.amount),
        0,
      ),
  );
}

export function calculateEnvelopeSummaries(
  envelopes: Envelope[],
  events: EnvelopeEvent[],
  options: EnvelopeSummaryOptions = {},
) {
  return envelopes
    .filter((envelope) => !envelope.isArchived)
    .sort(
      (left, right) =>
        left.priority - right.priority || left.name.localeCompare(right.name),
    )
    .map((envelope) =>
      calculateEnvelopeSummary(envelope, events, options),
    );
}

export function calculateUnassignedCash({
  accounts,
  transactions,
  summaries,
  minimumOperatingBalance = 0,
}: {
  accounts: Account[];
  transactions: Transaction[];
  summaries: EnvelopeSummary[];
  minimumOperatingBalance?: number;
}) {
  const cashBalance = accounts
    .filter(
      (account) =>
        !account.isArchived && account.classification === "asset",
    )
    .reduce(
      (total, account) =>
        total + calculateAccountBalance(account, transactions),
      0,
    );
  const assigned = summaries.reduce(
    (total, summary) => total + Math.max(0, summary.available),
    0,
  );
  return cents(
    cashBalance - assigned - Math.max(0, minimumOperatingBalance),
  );
}

export function suggestEnvelopeForTransaction(
  transaction: Pick<Transaction, "accountId" | "categoryId" | "type">,
  envelopes: Envelope[],
) {
  if (transaction.type === "transfer") return undefined;
  const active = envelopes.filter((envelope) => !envelope.isArchived);
  return (
    active.find(
      (envelope) =>
        envelope.backingAccountId &&
        envelope.backingAccountId === transaction.accountId,
    ) ??
    active.find(
      (envelope) =>
        transaction.categoryId &&
        envelope.categoryIds.includes(transaction.categoryId),
    )
  );
}

export function envelopeEventForTransaction(
  transaction: Transaction,
  operatingAccountId?: string | null,
): EnvelopeEvent | null {
  if (
    transaction.type === "transfer" ||
    !transaction.envelopeId ||
    !isTransactionFinalized(transaction)
  ) {
    return null;
  }
  return {
    id: `transaction-${transaction.id}`,
    envelopeId: transaction.envelopeId,
    type: transaction.type === "income" ? "refund" : "expense",
    amount: Math.abs(transaction.amount),
    date: transaction.date,
    transactionId: transaction.id,
    usesReleasedFunds:
      Boolean(operatingAccountId) &&
      transaction.accountId === operatingAccountId,
    note: transaction.description,
    createdAt: new Date().toISOString(),
  };
}

export function envelopeEventsForTransfer({
  transferId,
  envelopeId,
  relatedEnvelopeId,
  purpose,
  amount,
  date,
  note,
}: {
  transferId: string;
  envelopeId?: string;
  relatedEnvelopeId?: string;
  purpose?: TransferPurpose;
  amount: number;
  date: string;
  note?: string;
}): EnvelopeEvent[] {
  if (!envelopeId || !purpose || purpose === "ordinary") return [];
  const common = {
    amount: Math.abs(amount),
    date,
    transferId,
    note,
    createdAt: new Date().toISOString(),
  };
  if (purpose === "reallocate") {
    if (!relatedEnvelopeId || relatedEnvelopeId === envelopeId) return [];
    return [
      {
        ...common,
        id: `transfer-${transferId}-out`,
        envelopeId,
        relatedEnvelopeId,
        type: "reassign-out",
      },
      {
        ...common,
        id: `transfer-${transferId}-in`,
        envelopeId: relatedEnvelopeId,
        relatedEnvelopeId: envelopeId,
        type: "reassign-in",
      },
    ];
  }
  const type = {
    "fund-envelope": "fund",
    "release-to-spend": "release",
    "return-unused": "return",
    unassign: "unassign",
  }[purpose] as EnvelopeEvent["type"] | undefined;
  return type
    ? [
        {
          ...common,
          id: `transfer-${transferId}`,
          envelopeId,
          type,
        },
      ]
    : [];
}
