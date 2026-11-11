import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebaseAdmin";
import { AuthenticationError, requireUid } from "@/lib/requireUid";

const MatchSchema = z.object({
  operator: z.enum(["exact", "contains"]),
  value: z.string().trim().min(1).max(300),
});

const RuleValuesSchema = z.object({
  name: z.string().trim().min(1).max(160),
  enabled: z.boolean(),
  priority: z.number().int().min(-100_000).max(100_000),
  conditions: z.object({
    direction: z.enum(["income", "expense"]).optional(),
    accountIds: z.array(z.string().min(1).max(200)).max(100).optional(),
    merchantMatch: MatchSchema.optional(),
    descriptionMatch: MatchSchema.optional(),
    providerCategoryPrimary: z.string().max(300).optional(),
    providerCategoryDetailed: z.string().max(300).optional(),
    minimumAmount: z.number().min(0).max(90_000_000_000).optional(),
    maximumAmount: z.number().min(0).max(90_000_000_000).optional(),
  }).refine(
    ({ minimumAmount, maximumAmount }) =>
      minimumAmount === undefined
      || maximumAmount === undefined
      || minimumAmount <= maximumAmount,
    { message: "The amount range is invalid." },
  ),
  actions: z.object({
    categoryId: z.string().min(1).max(500),
    categoryName: z.string().min(1).max(500),
    envelopeId: z.string().min(1).max(200).nullable().optional(),
    markReviewed: z.boolean(),
  }),
});

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), values: RuleValuesSchema }),
  z.object({
    action: z.literal("update"),
    ruleId: z.string().min(1).max(200).regex(/^[^/]+$/),
    values: RuleValuesSchema.partial(),
  }),
  z.object({
    action: z.literal("delete"),
    ruleId: z.string().min(1).max(200).regex(/^[^/]+$/),
  }),
]);

export async function POST(request: Request) {
  try {
    const uid = await requireUid(request);
    if (!adminDb) throw new Error("Firestore Admin is not initialized.");
    const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid categorization rule request." }, { status: 400 });
    }

    const user = adminDb.collection("users").doc(uid);
    const rules = user.collection("categorizationRules");
    const audit = user.collection("categorizationAudit");
    const now = new Date().toISOString();

    const input = parsed.data;
    if (input.action === "create") {
      const values = input.values;
      const rule = rules.doc();
      await adminDb.runTransaction(async (transaction) => {
        transaction.create(rule, {
          ...values,
          id: rule.id,
          createdAt: now,
          updatedAt: now,
        });
        transaction.create(audit.doc(), {
          id: `rule-created-${rule.id}`,
          type: "rule-created",
          ruleId: rule.id,
          createdAt: now,
        });
      });
      return NextResponse.json({ id: rule.id });
    }

    const rule = rules.doc(input.ruleId);
    await adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(rule);
      if (!existing.exists) throw new Error("Categorization rule was not found.");

      if (input.action === "update") {
        transaction.update(rule, { ...input.values, updatedAt: now });
        transaction.create(audit.doc(), {
          type: "rule-updated",
          ruleId: rule.id,
          createdAt: now,
        });
      } else {
        transaction.delete(rule);
        transaction.create(audit.doc(), {
          type: "rule-deleted",
          ruleId: rule.id,
          createdAt: now,
        });
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof AuthenticationError
      ? 401
      : error instanceof Error && error.message.includes("not found")
        ? 404
        : 500;
    return NextResponse.json(
      { error: status === 401 ? "Authentication required." : "Unable to save the categorization rule." },
      { status },
    );
  }
}
