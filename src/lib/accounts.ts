import type {
  Account,
  AccountClassification,
  AccountRole,
  AccountType,
  Transaction,
  TransferPurpose,
} from "@/types";
import { isTransactionFinalized } from "@/lib/categorization";
import { canonicalMoneyFields, minorToMajor, moneyMinor, signedMoneyMinor } from "@/lib/money";
import { transactionLedgerDate } from "@/lib/ledger-date";

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
    | "type"
    | "postingStatus"
    | "providerRemovedAt"
    | "possibleTransfer"
    | "source"
    | "recurringExpectationOnly"
  >,
): boolean {
  return (
    isTransactionFinalized(transaction) &&
    !transaction.possibleTransfer &&
    !isRecurringExpectationTransaction(transaction) &&
    (transaction.type === "income" ||
      transaction.type === "expense")
  );
}

/** Explicit recurring provenance identifies a schedule expectation, not an
 * observed ledger event. Description prefixes alone are intentionally ignored
 * so a manually entered transaction is never reclassified by text. */
export function isRecurringExpectationTransaction(
  transaction: Pick<Transaction, "source" | "recurringExpectationOnly">,
): boolean {
  return (
    transaction.recurringExpectationOnly === true ||
    transaction.source === "recurring"
  );
}

export function transferBalanceDelta(
  transaction: Pick<
    Transaction,
    | "type"
    | "transferDirection"
    | "amount"
    | "amountMinor"
    | "currency"
    | "postingStatus"
    | "providerRemovedAt"
  >,
): number {
  return minorToMajor(transferBalanceDeltaMinor(transaction));
}

export function transferBalanceDeltaMinor(
  transaction: Pick<Transaction, "type" | "transferDirection" | "amount" | "amountMinor" | "currency" | "postingStatus" | "providerRemovedAt">,
): number {
  if (
    transaction.type !== "transfer" ||
    !isTransactionFinalized(transaction)
  ) return 0;
  const amount = moneyMinor(transaction);
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
    | "amountMinor"
    | "currency"
    | "postingStatus"
    | "providerRemovedAt"
    | "source"
    | "recurringExpectationOnly"
  >,
): number {
  return minorToMajor(transactionBalanceDeltaMinor(transaction));
}

export function transactionBalanceDeltaMinor(
  transaction: Pick<Transaction, "type" | "transferDirection" | "amount" | "amountMinor" | "currency" | "postingStatus" | "providerRemovedAt" | "source" | "recurringExpectationOnly">,
): number {
  if (
    !isTransactionFinalized(transaction) ||
    isRecurringExpectationTransaction(transaction)
  ) return 0;
  const amount = moneyMinor(transaction);
  if (transaction.type === "income") return amount;
  if (transaction.type === "expense") return -amount;
  return transferBalanceDeltaMinor(transaction);
}

export function accountOpeningBalance(account: Pick<Account, "openingBalance" | "openingBalanceMinor" | "currency">): number {
  return minorToMajor(signedMoneyMinor({ amount: account.openingBalance, amountMinor: account.openingBalanceMinor, currency: account.currency }));
}

export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[],
): number {
  const balanceMinor = transactions
    .filter(
      (transaction) =>
        transaction.accountId === account.id ||
        (!transaction.accountId && account.isDefault),
    )
    .reduce(
      (balance, transaction) => balance + transactionBalanceDeltaMinor(transaction),
      signedMoneyMinor({ amount: account.openingBalance, amountMinor: account.openingBalanceMinor, currency: account.currency }),
    );
  return minorToMajor(balanceMinor);
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

function transactionDateKey(transaction: Pick<Transaction, "date" | "ledgerDate">) {
  return transactionLedgerDate(transaction);
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
  const cutoff = typeof statementDate === "string"
    ? transactionLedgerDate({ date: statementDate })
    : transactionLedgerDate({ date: statementDate.toISOString() });
  const balanceMinor = transactions
    .filter(
      (transaction) =>
        belongsToAccount(account, transaction) &&
        transactionDateKey(transaction) <= cutoff,
    )
    .reduce(
      (balance, transaction) => balance + transactionBalanceDeltaMinor(transaction),
      signedMoneyMinor({ amount: account.openingBalance, amountMinor: account.openingBalanceMinor, currency: account.currency }),
    );
  return minorToMajor(balanceMinor);
}

export function calculateAccountBalanceBefore(
  account: Account,
  transactions: Transaction[],
  date: Date | string,
): number {
  const cutoff = transactionLedgerDate({
    date: typeof date === "string" ? date : date.toISOString(),
  });
  const balanceMinor = transactions
    .filter(
      (transaction) =>
        belongsToAccount(account, transaction) &&
        transactionDateKey(transaction) < cutoff,
    )
    .reduce(
      (balance, transaction) => balance + transactionBalanceDeltaMinor(transaction),
      signedMoneyMinor({ amount: account.openingBalance, amountMinor: account.openingBalanceMinor, currency: account.currency }),
    );
  return minorToMajor(balanceMinor);
}

export interface AccountLedgerEntry {
  transaction: Transaction;
  runningBalance: number;
}

export function buildAccountLedger(
  account: Account,
  transactions: Transaction[],
): AccountLedgerEntry[] {
  let runningBalance = accountOpeningBalance(account);
  return transactions
    .filter(
      (transaction) =>
        belongsToAccount(account, transaction) &&
        transaction.postingStatus !== "removed" &&
        !transaction.providerRemovedAt,
    )
    .sort(
      (left, right) =>
        transactionDateKey(left).localeCompare(transactionDateKey(right)) ||
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
      const key = transactionDateKey(transaction);
      return key >= localDateKey(new Date(fromTime)) && key <= localDateKey(new Date(toTime));
    })
    .forEach((transaction) => {
      const key = transactionDateKey(transaction);
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
    ...canonicalMoneyFields(input.amount),
    ledgerDate: transactionLedgerDate({ date: input.date }),
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
