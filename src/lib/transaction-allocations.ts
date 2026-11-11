import type { Transaction, TransactionAllocation } from "@/types";
import { canonicalMoneyFields, minorToMajor, moneyMinor } from "@/lib/money";

function allocationMinor(allocation: TransactionAllocation): number {
  return moneyMinor(allocation);
}

export function allocationTotal(
  allocations?: TransactionAllocation[],
): number {
  return minorToMajor(
    (allocations ?? []).reduce(
      (total, allocation) =>
        total + allocationMinor(allocation),
      0,
    ),
  );
}

export function allocationDifference(
  amount: number,
  allocations?: TransactionAllocation[],
): number {
  return minorToMajor(
    moneyMinor({ amount }) -
      (allocations ?? []).reduce((sum, allocation) => sum + allocationMinor(allocation), 0),
  );
}

export function allocationsAreComplete(
  amount: number,
  allocations?: TransactionAllocation[],
): boolean {
  return (
    Boolean(allocations && allocations.length >= 2) &&
    allocations!.every(
      (allocation) =>
        Boolean(
          allocation.id &&
          allocation.categoryId &&
          allocation.category.trim() &&
          allocation.category !== "Unallocated",
        ) &&
        allocationMinor(allocation) > 0,
    ) &&
    moneyMinor({ amount: allocationDifference(amount, allocations) }) === 0
  );
}

/**
 * Expands a bank transaction into reporting-only category lines. The source
 * transaction remains the only record used for account balances.
 */
export function expandTransactionAllocations(
  transaction: Transaction,
): Transaction[] {
  if (transaction.type === "transfer") {
    return [transaction];
  }
  if (!transaction.allocations || transaction.allocations.length === 0) {
    return transaction.refundOfTransactionId && transaction.refundStatus === "confirmed"
      ? [{ ...transaction, type: "expense" }]
      : [transaction];
  }

  const transactionCents = moneyMinor(transaction);
  let remainingCents = transactionCents;
  const entries: Transaction[] = [];

  for (const allocation of transaction.allocations) {
    const requestedCents = allocationMinor(allocation);
    const allocatedCents = Math.min(remainingCents, requestedCents);
    if (allocatedCents <= 0) continue;
    entries.push({
      ...transaction,
      id: `${transaction.id}::allocation::${allocation.id}`,
      ...canonicalMoneyFields(minorToMajor(allocatedCents)),
      type: transaction.refundOfTransactionId && transaction.refundStatus === "confirmed" ? "expense" : transaction.type,
      category: allocation.category || "Unallocated",
      categoryId: allocation.categoryId,
      envelopeId: allocation.envelopeId ?? null,
      allocations: undefined,
      allocationParentId: transaction.id,
      allocationId: allocation.id,
    });
    remainingCents -= allocatedCents;
  }

  if (remainingCents > 0) {
    entries.push({
      ...transaction,
      id: `${transaction.id}::allocation::unallocated`,
      ...canonicalMoneyFields(minorToMajor(remainingCents)),
      type: transaction.refundOfTransactionId && transaction.refundStatus === "confirmed" ? "expense" : transaction.type,
      category: "Unallocated",
      categoryId: undefined,
      envelopeId: null,
      allocations: undefined,
      allocationParentId: transaction.id,
      allocationId: "unallocated",
      allocationStatus: "incomplete",
    });
  }

  return entries.length > 0 ? entries : [transaction];
}

/** Writes both rollout fields and requires split lines to reconcile exactly in cents. */
export function canonicalizeTransactionMoney(transaction: Transaction): Transaction {
  const money = transaction.amountMinor === undefined
    ? canonicalMoneyFields(transaction.amount)
    : canonicalMoneyFields(transaction);
  const allocations = transaction.allocations?.map((allocation) => ({
    ...allocation,
    ...(allocation.amountMinor === undefined
      ? canonicalMoneyFields(allocation.amount)
      : canonicalMoneyFields(allocation)),
  }));
  if (allocations && allocations.length > 0) {
    const allocated = allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0);
    if (allocated !== money.amountMinor) throw new Error("Split allocations must equal the transaction amount exactly.");
  }
  const canonical = { ...transaction, ...money };
  if (allocations === undefined) {
    delete canonical.allocations;
  } else {
    canonical.allocations = allocations;
  }
  return canonical;
}

export function expandTransactionsForReporting(
  transactions: Transaction[],
): Transaction[] {
  return transactions.flatMap(expandTransactionAllocations);
}

export function sourceTransactionId(transaction: Transaction): string {
  return transaction.allocationParentId ?? transaction.id;
}
