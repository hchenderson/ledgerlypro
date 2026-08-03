import type { Transaction } from "@/types";
import { isTransactionFinalized } from "@/lib/categorization";

export type TransferMatchConfidence = "high" | "possible";

export interface TransferCandidate {
  id: string;
  outgoing: Transaction;
  incoming: Transaction;
  amount: number;
  dateDifferenceDays: number;
  confidence: TransferMatchConfidence;
}

const DAY_IN_MS = 24 * 60 * 60 * 1_000;
const TRANSFER_WORDS =
  /\b(transfer|xfer|payment|paydown|card payment|move money)\b/i;
const DESCRIPTION_STOP_WORDS = new Set([
  "the",
  "and",
  "from",
  "into",
  "online",
  "payment",
  "to",
  "transfer",
]);

function descriptionTokens(description: string): Set<string> {
  return new Set(
    description
      .toLocaleLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(
        (token) =>
          token.length > 2 && !DESCRIPTION_STOP_WORDS.has(token),
      ),
  );
}

function descriptionsOverlap(left: string, right: string): boolean {
  const leftTokens = descriptionTokens(left);
  const rightTokens = descriptionTokens(right);
  return [...leftTokens].some((token) => rightTokens.has(token));
}

function dateDifferenceDays(left: string, right: string): number {
  return Math.round(
    Math.abs(
      new Date(left).getTime() - new Date(right).getTime(),
    ) / DAY_IN_MS,
  );
}

function amountInCents(transaction: Transaction): number {
  return Math.round(Math.abs(transaction.amount) * 100);
}

function isMatchable(transaction: Transaction): boolean {
  return (
    isTransactionFinalized(transaction) &&
    (transaction.type === "income" ||
      transaction.type === "expense") &&
    Boolean(transaction.accountId) &&
    !transaction.transferId &&
    !transaction.linkedTransactionId &&
    Number.isFinite(transaction.amount) &&
    transaction.amount > 0 &&
    Number.isFinite(new Date(transaction.date).getTime())
  );
}

export function findTransferCandidates(
  transactions: Transaction[],
  {
    maximumDayDifference = 3,
    limit = 12,
  }: {
    maximumDayDifference?: number;
    limit?: number;
  } = {},
): TransferCandidate[] {
  const incomeByAmount = new Map<number, Transaction[]>();
  const expenses = transactions.filter(
    (transaction) =>
      isMatchable(transaction) && transaction.type === "expense",
  );

  transactions
    .filter(
      (transaction) =>
        isMatchable(transaction) && transaction.type === "income",
    )
    .forEach((transaction) => {
      const cents = amountInCents(transaction);
      incomeByAmount.set(cents, [
        ...(incomeByAmount.get(cents) ?? []),
        transaction,
      ]);
    });

  const possible = expenses.flatMap((outgoing) =>
    (incomeByAmount.get(amountInCents(outgoing)) ?? [])
      .filter(
        (incoming) =>
          incoming.accountId !== outgoing.accountId &&
          dateDifferenceDays(outgoing.date, incoming.date) <=
            maximumDayDifference,
      )
      .map((incoming) => {
        const dayDifference = dateDifferenceDays(
          outgoing.date,
          incoming.date,
        );
        const transferLanguage =
          TRANSFER_WORDS.test(outgoing.description) ||
          TRANSFER_WORDS.test(incoming.description);
        const confidence: TransferMatchConfidence =
          dayDifference === 0 &&
          (transferLanguage ||
            descriptionsOverlap(
              outgoing.description,
              incoming.description,
            ))
            ? "high"
            : "possible";

        return {
          id: `${outgoing.id}:${incoming.id}`,
          outgoing,
          incoming,
          amount: Math.abs(outgoing.amount),
          dateDifferenceDays: dayDifference,
          confidence,
        };
      }),
  );

  possible.sort((left, right) => {
    const confidenceDifference =
      Number(right.confidence === "high") -
      Number(left.confidence === "high");
    if (confidenceDifference !== 0) return confidenceDifference;
    if (left.dateDifferenceDays !== right.dateDifferenceDays) {
      return left.dateDifferenceDays - right.dateDifferenceDays;
    }
    return (
      new Date(right.outgoing.date).getTime() -
      new Date(left.outgoing.date).getTime()
    );
  });

  const usedTransactions = new Set<string>();
  const candidates: TransferCandidate[] = [];
  for (const candidate of possible) {
    if (
      usedTransactions.has(candidate.outgoing.id) ||
      usedTransactions.has(candidate.incoming.id)
    ) {
      continue;
    }
    usedTransactions.add(candidate.outgoing.id);
    usedTransactions.add(candidate.incoming.id);
    candidates.push(candidate);
    if (candidates.length >= limit) break;
  }

  return candidates;
}
