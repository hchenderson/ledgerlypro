import type { Transaction, TransactionAllocation } from "@/types";

const cents = (value: number) => Math.round(value * 100);
const dollars = (value: number) => value / 100;

export function allocationTotal(
  allocations?: TransactionAllocation[],
): number {
  return dollars(
    (allocations ?? []).reduce(
      (total, allocation) =>
        total + Math.max(0, cents(Number(allocation.amount) || 0)),
      0,
    ),
  );
}

export function allocationDifference(
  amount: number,
  allocations?: TransactionAllocation[],
): number {
  return dollars(cents(Math.abs(amount)) - cents(allocationTotal(allocations)));
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
        cents(allocation.amount) > 0,
    ) &&
    cents(allocationDifference(amount, allocations)) === 0
  );
}

/**
 * Expands a bank transaction into reporting-only category lines. The source
 * transaction remains the only record used for account balances.
 */
export function expandTransactionAllocations(
  transaction: Transaction,
): Transaction[] {
  if (
    transaction.type === "transfer" ||
    !transaction.allocations ||
    transaction.allocations.length === 0
  ) {
    return [transaction];
  }

  const transactionCents = Math.max(0, cents(Math.abs(transaction.amount)));
  let remainingCents = transactionCents;
  const entries: Transaction[] = [];

  for (const allocation of transaction.allocations) {
    const requestedCents = Math.max(0, cents(Number(allocation.amount) || 0));
    const allocatedCents = Math.min(remainingCents, requestedCents);
    if (allocatedCents <= 0) continue;
    entries.push({
      ...transaction,
      id: `${transaction.id}::allocation::${allocation.id}`,
      amount: dollars(allocatedCents),
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
      amount: dollars(remainingCents),
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

export function expandTransactionsForReporting(
  transactions: Transaction[],
): Transaction[] {
  return transactions.flatMap(expandTransactionAllocations);
}

export function sourceTransactionId(transaction: Transaction): string {
  return transaction.allocationParentId ?? transaction.id;
}
