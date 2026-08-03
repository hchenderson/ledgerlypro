import { createHash } from "node:crypto";

import { categorizeTransaction } from "@/lib/categorization";
import type {
  AccountType,
  CategorizationRule,
  Transaction,
} from "@/types";

export interface PlaidAccountPayload {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  balances: {
    current?: number | null;
    available?: number | null;
    limit?: number | null;
    iso_currency_code?: string | null;
    unofficial_currency_code?: string | null;
  };
}

export interface PlaidTransactionPayload {
  transaction_id: string;
  pending_transaction_id?: string | null;
  account_id: string;
  amount: number;
  date: string;
  authorized_date?: string | null;
  datetime?: string | null;
  authorized_datetime?: string | null;
  name: string;
  original_description?: string | null;
  merchant_name?: string | null;
  logo_url?: string | null;
  pending: boolean;
  personal_finance_category?: {
    primary?: string | null;
    detailed?: string | null;
    confidence_level?: string | null;
  } | null;
}

export function stablePlaidTransactionDocumentId(
  plaidItemId: string,
  providerTransactionId: string,
) {
  return `plaid-${createHash("sha256")
    .update(`${plaidItemId}:${providerTransactionId}`)
    .digest("hex")
    .slice(0, 32)}`;
}

export function plaidAccountType(type: string, subtype?: string | null): AccountType {
  if (type === "credit" || subtype === "credit card") return "credit";
  if (subtype === "checking") return "checking";
  if (subtype === "savings" || subtype === "money market") return "savings";
  if (subtype === "cash management") return "cash";
  return "other";
}

export function normalizePlaidTransaction({
  plaidItemId,
  accountId,
  transaction,
  rules,
  now = new Date().toISOString(),
}: {
  plaidItemId: string;
  accountId: string;
  transaction: PlaidTransactionPayload;
  rules: CategorizationRule[];
  now?: string;
}): Transaction {
  const primary =
    transaction.personal_finance_category?.primary ?? undefined;
  const detailed =
    transaction.personal_finance_category?.detailed ?? undefined;
  const type = transaction.amount >= 0 ? "expense" : "income";
  const possibleTransfer =
    Boolean(primary?.startsWith("TRANSFER")) ||
    Boolean(detailed?.startsWith("TRANSFER"));
  const normalized: Transaction = {
    id: stablePlaidTransactionDocumentId(
      plaidItemId,
      transaction.transaction_id,
    ),
    date: transaction.datetime ?? `${transaction.date}T12:00:00.000Z`,
    authorizedDate:
      transaction.authorized_datetime ??
      (transaction.authorized_date
        ? `${transaction.authorized_date}T12:00:00.000Z`
        : undefined),
    description:
      transaction.merchant_name?.trim() || transaction.name.trim(),
    providerDescription:
      transaction.original_description?.trim() || transaction.name.trim(),
    merchantName: transaction.merchant_name?.trim() || undefined,
    merchantLogoUrl: transaction.logo_url ?? undefined,
    amount: Math.abs(transaction.amount),
    type,
    category: "Uncategorized",
    accountId,
    source: "plaid",
    postingStatus: transaction.pending ? "pending" : "posted",
    provider: "plaid",
    providerItemId: plaidItemId,
    providerAccountId: transaction.account_id,
    providerTransactionId: transaction.transaction_id,
    pendingProviderTransactionId:
      transaction.pending_transaction_id ?? undefined,
    providerCategoryPrimary: primary,
    providerCategoryDetailed: detailed,
    providerCategoryConfidence:
      transaction.personal_finance_category?.confidence_level ?? undefined,
    providerLastSyncedAt: now,
    possibleTransfer,
  };
  const categorization = categorizeTransaction(normalized, rules);
  return {
    ...normalized,
    category: categorization.categoryName,
    categoryId: categorization.categoryId,
    envelopeId: categorization.envelopeId,
    categorizationStatus: categorization.status,
    categorizationSource: categorization.source,
    categorizationRuleId: categorization.ruleId,
    categorizationConflictRuleIds: categorization.conflictRuleIds,
    categorizedAt:
      categorization.source === "rule" ? now : undefined,
    reviewedAt: categorization.reviewed ? now : undefined,
    classificationLocked: false,
  };
}
