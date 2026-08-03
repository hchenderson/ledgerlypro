import type {
  CategorizationRule,
  Transaction,
} from "@/types";

export interface CategorizationResult {
  categoryId?: string;
  categoryName: string;
  envelopeId?: string | null;
  status: Transaction["categorizationStatus"];
  source: Transaction["categorizationSource"];
  ruleId?: string;
  conflictRuleIds?: string[];
  reviewed: boolean;
}

export function normalizeRuleText(value?: string | null): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\b(?:STORE|LOCATION|POS|DEBIT|PURCHASE)\b/g, " ")
    .replace(/[#*]\s*\d+\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function textMatches(
  actual: string,
  expected: string,
  operator: "exact" | "contains",
) {
  const normalizedActual = normalizeRuleText(actual);
  const normalizedExpected = normalizeRuleText(expected);
  if (!normalizedExpected) return false;
  return operator === "exact"
    ? normalizedActual === normalizedExpected
    : normalizedActual.includes(normalizedExpected);
}

export function categorizationRuleMatches(
  rule: CategorizationRule,
  transaction: Pick<
    Transaction,
    | "accountId"
    | "amount"
    | "description"
    | "merchantName"
    | "providerCategoryDetailed"
    | "providerCategoryPrimary"
    | "type"
  >,
): boolean {
  if (!rule.enabled || transaction.type === "transfer") return false;
  const { conditions } = rule;
  if (conditions.direction && conditions.direction !== transaction.type) {
    return false;
  }
  if (
    conditions.accountIds?.length &&
    (!transaction.accountId ||
      !conditions.accountIds.includes(transaction.accountId))
  ) {
    return false;
  }
  if (
    conditions.merchantMatch &&
    !textMatches(
      transaction.merchantName ?? transaction.description,
      conditions.merchantMatch.value,
      conditions.merchantMatch.operator,
    )
  ) {
    return false;
  }
  if (
    conditions.descriptionMatch &&
    !textMatches(
      transaction.description,
      conditions.descriptionMatch.value,
      conditions.descriptionMatch.operator,
    )
  ) {
    return false;
  }
  if (
    conditions.providerCategoryPrimary &&
    conditions.providerCategoryPrimary !==
      transaction.providerCategoryPrimary
  ) {
    return false;
  }
  if (
    conditions.providerCategoryDetailed &&
    conditions.providerCategoryDetailed !==
      transaction.providerCategoryDetailed
  ) {
    return false;
  }
  const amount = Math.abs(transaction.amount);
  if (
    conditions.minimumAmount !== undefined &&
    amount < conditions.minimumAmount
  ) {
    return false;
  }
  if (
    conditions.maximumAmount !== undefined &&
    amount > conditions.maximumAmount
  ) {
    return false;
  }
  return true;
}

function ruleSpecificity(rule: CategorizationRule): number {
  const { conditions } = rule;
  return [
    Boolean(conditions.direction),
    Boolean(conditions.accountIds?.length),
    conditions.merchantMatch?.operator === "exact",
    conditions.merchantMatch?.operator === "contains",
    Boolean(conditions.descriptionMatch),
    Boolean(conditions.providerCategoryDetailed),
    Boolean(conditions.providerCategoryPrimary),
    conditions.minimumAmount !== undefined,
    conditions.maximumAmount !== undefined,
  ].reduce((score, present) => score + (present ? 1 : 0), 0);
}

export function categorizeTransaction(
  transaction: Transaction,
  rules: CategorizationRule[],
): CategorizationResult {
  if (transaction.classificationLocked && transaction.categoryId) {
    return {
      categoryId: transaction.categoryId,
      categoryName: transaction.category,
      envelopeId: transaction.envelopeId,
      status: "manually-categorized",
      source: "manual",
      reviewed: true,
    };
  }

  if (transaction.possibleTransfer) {
    return {
      categoryName: "Uncategorized",
      status: "needs-review",
      source: "uncategorized",
      reviewed: false,
    };
  }

  const matches = rules
    .filter((rule) => categorizationRuleMatches(rule, transaction))
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        ruleSpecificity(right) - ruleSpecificity(left) ||
        left.id.localeCompare(right.id),
    );
  const winner = matches[0];
  if (!winner) {
    return {
      categoryName: "Uncategorized",
      status: transaction.possibleTransfer
        ? "needs-review"
        : "needs-categorization",
      source: "uncategorized",
      reviewed: false,
    };
  }

  const sameRank = matches.filter(
    (candidate) =>
      candidate.priority === winner.priority &&
      ruleSpecificity(candidate) === ruleSpecificity(winner),
  );
  const conflicting = sameRank.filter(
    (candidate) =>
      candidate.actions.categoryId !== winner.actions.categoryId ||
      (candidate.actions.envelopeId ?? null) !==
        (winner.actions.envelopeId ?? null),
  );
  if (conflicting.length > 0) {
    return {
      categoryName: "Uncategorized",
      status: "needs-review",
      source: "uncategorized",
      conflictRuleIds: [winner, ...conflicting].map((rule) => rule.id),
      reviewed: false,
    };
  }

  return {
    categoryId: winner.actions.categoryId,
    categoryName: winner.actions.categoryName,
    envelopeId: winner.actions.envelopeId,
    status: winner.actions.markReviewed
      ? "auto-categorized"
      : "needs-review",
    source: "rule",
    ruleId: winner.id,
    reviewed: winner.actions.markReviewed,
  };
}

export function isTransactionFinalized(
  transaction: Pick<Transaction, "postingStatus" | "providerRemovedAt">,
) {
  return (
    transaction.postingStatus !== "pending" &&
    transaction.postingStatus !== "removed" &&
    !transaction.providerRemovedAt
  );
}

export function isTransactionReviewable(
  transaction: Pick<
    Transaction,
    "categorizationStatus" | "postingStatus" | "providerRemovedAt"
  >,
) {
  return (
    !transaction.providerRemovedAt &&
    transaction.postingStatus !== "removed" &&
    (transaction.categorizationStatus === "needs-categorization" ||
      transaction.categorizationStatus === "needs-review")
  );
}
