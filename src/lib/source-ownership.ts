/**
 * DATA-001 ownership contract.
 * Provider-owned fields are refreshed from Plaid; user-owned fields survive resync.
 */
export const PROVIDER_OWNED_TRANSACTION_FIELDS = [
  "sourceAmountMinor", "sourceCurrency", "sourceTransactionDate", "sourcePostedAt",
  "sourceAuthorizedAt", "postingStatus", "providerRemovedAt", "providerDescription",
  "merchantName", "merchantLogoUrl", "providerCategoryPrimary",
  "providerCategoryDetailed", "providerCategoryConfidence", "providerLastSyncedAt",
] as const;

export const USER_OWNED_TRANSACTION_FIELDS = [
  "description", "category", "categoryId", "envelopeId", "allocations",
  "classificationLocked", "refundOfTransactionId", "refundStatus",
  "recurringOccurrenceId", "recurringReconciliationStatus",
] as const;

export const DERIVED_TRANSACTION_FIELDS = [
  "amount", "amountMinor", "currency", "date", "ledgerDate", "possibleTransfer",
] as const;
