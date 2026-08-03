import type {
  Account,
  AccountClassification,
  AccountRole,
  AccountType,
  Transaction,
  TransferPurpose,
} from "@/types";
import { isTransactionFinalized } from "@/lib/categorization";

export const PRIMARY_ACCOUNT_ID = "primary-account";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit: "Credit Card",
  cash: "Cash",
  other: "Other",
};

export function accountClassificationForType(
  type: AccountType,
): AccountClassification {
  return type === "credit" ? "liability" : "asset";
}

export function defaultAccountRoleForType(type: AccountType): AccountRole {
  return type === "credit" ? "debt" : "standard";
}

export function normalizeOpeningBalance(
  type: AccountType,
  displayedBalance: number,
): number {
  if (!Number.isFinite(displayedBalance)) return 0;
  return type === "credit"
    ? -Math.abs(displayedBalance)
    : displayedBalance;
}

export function displayAccountBalance(
  account: Pick<Account, "classification">,
  balance: number,
): number {
  return account.classification === "liability"
    ? Math.abs(balance)
    : balance;
}

export function isFinancialTransaction(
  transaction: Pick<
    Transaction,
    "type" | "postingStatus" | "providerRemovedAt" | "possibleTransfer"
  >,
): boolean {
  return (
    isTransactionFinalized(transaction) &&
    !transaction.possibleTransfer &&
    (transaction.type === "income" ||
      transaction.type === "expense")
  );
}

export function transferBalanceDelta(
  transaction: Pick<
    Transaction,
    | "type"
    | "transferDirection"
    | "amount"
    | "postingStatus"
    | "providerRemovedAt"
  >,
): number {
  if (
    transaction.type !== "transfer" ||
    !isTransactionFinalized(transaction)
  ) return 0;
  const amount = Math.abs(transaction.amount);
  if (transaction.transferDirection === "in") return amount;
  if (transaction.transferDirection === "out") return -amount;
  return 0;
}

export function transactionBalanceDelta(
  transaction: Pick<
    Transaction,
    | "type"
    | "transferDirection"
    | "amount"
    | "postingStatus"
    | "providerRemovedAt"
  >,
): number {
  if (!isTransactionFinalized(transaction)) return 0;
  const amount = Math.abs(transaction.amount);
  if (transaction.type === "income") return amount;
  if (transaction.type === "expense") return -amount;
  return transferBalanceDelta(transaction);
}

export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[],
): number {
  return transactions
    .filter(
      (transaction) =>
        transaction.accountId === account.id ||
        (!transaction.accountId && account.isDefault),
    )
    .reduce(
      (balance, transaction) =>
        balance + transactionBalanceDelta(transaction),
      account.openingBalance,
    );
}

function belongsToAccount(
  account: Account,
  transaction: Transaction,
): boolean {
  return (
    transaction.accountId === account.id ||
    (!transaction.accountId && Boolean(account.isDefault))
  );
}

function transactionTime(transaction: Pick<Transaction, "date">) {
  return new Date(transaction.date).getTime();
}

function endOfStatementDay(date: Date | string): number {
  if (
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(
      year,
      month - 1,
      day,
      23,
      59,
      59,
      999,
    ).getTime();
  }

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

export function calculateAccountBalanceAsOf(
  account: Account,
  transactions: Transaction[],
  statementDate: Date | string,
): number {
  const cutoff = endOfStatementDay(statementDate);
  return transactions
    .filter(
      (transaction) =>
        belongsToAccount(account, transaction) &&
        transactionTime(transaction) <= cutoff,
    )
    .reduce(
      (balance, transaction) =>
        balance + transactionBalanceDelta(transaction),
      account.openingBalance,
    );
}

export function calculateAccountBalanceBefore(
  account: Account,
  transactions: Transaction[],
  date: Date,
): number {
  const cutoff = date.getTime();
  return transactions
    .filter(
      (transaction) =>
        belongsToAccount(account, transaction) &&
        transactionTime(transaction) < cutoff,
    )
    .reduce(
      (balance, transaction) =>
        balance + transactionBalanceDelta(transaction),
      account.openingBalance,
    );
}

export interface AccountLedgerEntry {
  transaction: Transaction;
  runningBalance: number;
}

export function buildAccountLedger(
  account: Account,
  transactions: Transaction[],
): AccountLedgerEntry[] {
  let runningBalance = account.openingBalance;
  return transactions
    .filter(
      (transaction) =>
        belongsToAccount(account, transaction) &&
        transaction.postingStatus !== "removed" &&
        !transaction.providerRemovedAt,
    )
    .sort(
      (left, right) =>
        transactionTime(left) - transactionTime(right) ||
        left.id.localeCompare(right.id),
    )
    .map((transaction) => {
      runningBalance += transactionBalanceDelta(transaction);
      return { transaction, runningBalance };
    })
    .reverse();
}

export interface AccountBalancePoint {
  date: string;
  balance: number;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildAccountBalanceTimeline(
  account: Account,
  transactions: Transaction[],
  from: Date,
  to: Date,
): AccountBalancePoint[] {
  const fromTime = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
  ).getTime();
  const toTime = endOfStatementDay(to);
  let balance = calculateAccountBalanceBefore(
    account,
    transactions,
    new Date(fromTime),
  );
  const deltasByDay = new Map<string, number>();

  transactions
    .filter((transaction) => {
      if (!belongsToAccount(account, transaction)) return false;
      const time = transactionTime(transaction);
      return time >= fromTime && time <= toTime;
    })
    .forEach((transaction) => {
      const date = new Date(transaction.date);
      const key = localDateKey(date);
      deltasByDay.set(
        key,
        (deltasByDay.get(key) ?? 0) +
          transactionBalanceDelta(transaction),
      );
    });

  const points: AccountBalancePoint[] = [
    { date: localDateKey(new Date(fromTime)), balance },
  ];
  [...deltasByDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([date, delta]) => {
      balance += delta;
      if (points.at(-1)?.date === date) {
        points[points.length - 1] = { date, balance };
      } else {
        points.push({ date, balance });
      }
    });

  const endKey = localDateKey(new Date(toTime));
  if (points.at(-1)?.date !== endKey) {
    points.push({ date: endKey, balance });
  }
  return points;
}

export function statementBalanceToLedgerBalance(
  account: Pick<Account, "classification">,
  displayedBalance: number,
): number {
  return account.classification === "liability"
    ? -displayedBalance
    : displayedBalance;
}

export function ledgerBalanceToStatementBalance(
  account: Pick<Account, "classification">,
  ledgerBalance: number,
): number {
  return account.classification === "liability"
    ? -ledgerBalance
    : ledgerBalance;
}

export interface TransferInput {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  date: string;
  description?: string;
  purpose?: TransferPurpose;
  envelopeId?: string;
  relatedEnvelopeId?: string;
}

export function buildTransferTransactions({
  input,
  transferId,
  outgoingId,
  incomingId,
}: {
  input: TransferInput;
  transferId: string;
  outgoingId: string;
  incomingId: string;
}): [Transaction, Transaction] {
  if (
    !input.sourceAccountId ||
    !input.destinationAccountId ||
    input.sourceAccountId === input.destinationAccountId
  ) {
    throw new Error(
      "A transfer requires two different accounts.",
    );
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Transfer amount must be greater than zero.");
  }

  const description =
    input.description?.trim() || "Account transfer";
  const common = {
    date: input.date,
    description,
    amount: Math.abs(input.amount),
    type: "transfer" as const,
    category: "Transfer",
    transferId,
    transferPurpose: input.purpose ?? "ordinary",
    ...(input.envelopeId ? { envelopeId: input.envelopeId } : {}),
    ...(input.relatedEnvelopeId
      ? { relatedEnvelopeId: input.relatedEnvelopeId }
      : {}),
    source: "actual" as const,
  };

  return [
    {
      ...common,
      id: outgoingId,
      accountId: input.sourceAccountId,
      transferDirection: "out",
      linkedTransactionId: incomingId,
    },
    {
      ...common,
      id: incomingId,
      accountId: input.destinationAccountId,
      transferDirection: "in",
      linkedTransactionId: outgoingId,
    },
  ];
}
