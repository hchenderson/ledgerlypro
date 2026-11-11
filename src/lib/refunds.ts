import { isFinancialTransaction } from "@/lib/accounts";
import { canonicalMoneyFields, minorToMajor, moneyMinor } from "@/lib/money";
import { canonicalizeTransactionMoney } from "@/lib/transaction-allocations";
import type { Transaction, TransactionAllocation } from "@/types";

export interface RefundLinkInput {
  refund: Transaction;
  original: Transaction;
  existingRefunds: Transaction[];
  allocations?: TransactionAllocation[];
}

/**
 * Confirm a credit as an expense refund. The bank credit remains an income-type
 * account movement, while reporting treats the link as negative expense.
 */
export function buildRefundLink({ refund, original, existingRefunds, allocations }: RefundLinkInput): Transaction {
  if (refund.id === original.id) throw new Error("A transaction cannot refund itself.");
  if (refund.type !== "income" || !isFinancialTransaction(refund)) {
    throw new Error("Only a finalized account credit can be linked as a refund.");
  }
  if (original.type !== "expense" || !isFinancialTransaction(original)) {
    throw new Error("Refunds must link to a finalized expense.");
  }
  if (refund.refundOfTransactionId && refund.refundOfTransactionId !== original.id) {
    throw new Error("This credit is already linked to another purchase.");
  }
  const previouslyRefundedMinor = existingRefunds
    .filter((candidate) => candidate.id !== refund.id && candidate.refundOfTransactionId === original.id)
    .reduce((sum, candidate) => sum + moneyMinor(candidate), 0);
  const remainingMinor = moneyMinor(original) - previouslyRefundedMinor;
  if (moneyMinor(refund) > remainingMinor) {
    throw new Error(`Refund exceeds the remaining refundable amount of $${minorToMajor(Math.max(0, remainingMinor)).toFixed(2)}.`);
  }

  const originalSplit = Boolean(original.allocations?.length);
  if (originalSplit && !allocations?.length) {
    throw new Error("Choose how this refund applies to the original split categories.");
  }
  if (originalSplit && allocations) {
    const originalByCategory = new Map<string, number>();
    for (const allocation of original.allocations ?? []) {
      if (!allocation.categoryId) continue;
      originalByCategory.set(
        allocation.categoryId,
        (originalByCategory.get(allocation.categoryId) ?? 0) + moneyMinor(allocation),
      );
    }
    const refundedByCategory = new Map<string, number>();
    for (const prior of existingRefunds.filter((candidate) => candidate.id !== refund.id)) {
      for (const allocation of prior.allocations ?? []) {
        if (!allocation.categoryId) continue;
        refundedByCategory.set(
          allocation.categoryId,
          (refundedByCategory.get(allocation.categoryId) ?? 0) + moneyMinor(allocation),
        );
      }
    }
    for (const allocation of allocations) {
      const categoryId = allocation.categoryId;
      const allocatedMinor = moneyMinor(allocation);
      const available = (originalByCategory.get(categoryId ?? "") ?? 0) - (refundedByCategory.get(categoryId ?? "") ?? 0);
      if (!categoryId || !originalByCategory.has(categoryId) || allocatedMinor > available) {
        throw new Error("Refund allocation exceeds the refundable amount for an original split category.");
      }
      refundedByCategory.set(categoryId, (refundedByCategory.get(categoryId) ?? 0) + allocatedMinor);
    }
  }
  const next = canonicalizeTransactionMoney({
    ...refund,
    refundOfTransactionId: original.id,
    refundStatus: "confirmed",
    category: originalSplit ? "Refund allocation" : original.category,
    categoryId: originalSplit ? undefined : original.categoryId,
    envelopeId: originalSplit ? null : original.envelopeId,
    allocations: originalSplit ? allocations : undefined,
  });
  return { ...next, ...canonicalMoneyFields(next) };
}

export function refundableAmount(original: Transaction, refunds: Transaction[]): number {
  const used = refunds
    .filter((refund) => refund.refundOfTransactionId === original.id && refund.refundStatus === "confirmed")
    .reduce((sum, refund) => sum + moneyMinor(refund), 0);
  return minorToMajor(Math.max(0, moneyMinor(original) - used));
}
