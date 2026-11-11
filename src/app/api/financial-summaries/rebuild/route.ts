import { NextResponse } from "next/server";
import { z } from "zod";

import {
  FINANCIAL_AGGREGATE_VERSION,
  buildFinancialAggregateDocuments,
  type FinancialAggregateDocument,
} from "@/lib/financial-aggregates";
import { adminDb } from "@/lib/firebaseAdmin";
import { transactionLedgerDate } from "@/lib/ledger-date";
import { AuthenticationError, requireUid } from "@/lib/requireUid";
import type { Transaction } from "@/types";

const RequestSchema = z.object({
  year: z.number().int().min(1900).max(2200),
});

export async function POST(request: Request) {
  try {
    const uid = await requireUid(request);
    if (!adminDb) throw new Error("Firestore Admin is not initialized.");
    const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid summary year." }, { status: 400 });
    }

    const user = adminDb.collection("users").doc(uid);
    const [transactionSnapshot, existingSnapshot, settingsSnapshot] = await Promise.all([
      user.collection("transactions").get(),
      user.collection("financialSummaries").where("year", "==", parsed.data.year).get(),
      user.collection("settings").doc("main").get(),
    ]);
    const reportingTimeZone = typeof settingsSnapshot.data()?.reportingTimeZone === "string"
      ? settingsSnapshot.data()!.reportingTimeZone as string
      : "America/New_York";
    const transactions = transactionSnapshot.docs
      .map((document) => {
        const transaction = ({ ...document.data(), id: document.id }) as Transaction;
        const ledgerDate = transactionLedgerDate(transaction, reportingTimeZone);
        return { ...transaction, date: ledgerDate, ledgerDate };
      })
      .filter((transaction) =>
        Number(transactionLedgerDate(transaction, reportingTimeZone).slice(0, 4))
          === parsed.data.year,
      );
    const existing = new Map(
      existingSnapshot.docs.map((document) => [
        document.id,
        document.data() as FinancialAggregateDocument,
      ]),
    );
    const accountIds = new Set(
      [
        ...transactions.map((transaction) => transaction.accountId),
        ...existingSnapshot.docs.map(
          (document) => (document.data() as FinancialAggregateDocument).accountId,
        ),
      ].filter((accountId): accountId is string => Boolean(accountId)),
    );
    const next = [
      ...buildFinancialAggregateDocuments(transactions, parsed.data.year),
      ...[...accountIds].flatMap((accountId) =>
        buildFinancialAggregateDocuments(transactions, parsed.data.year, accountId),
      ),
    ].filter((summary) =>
      existing.get(summary.id)?.sourceFingerprint !== summary.sourceFingerprint
      || existing.get(summary.id)?.version !== FINANCIAL_AGGREGATE_VERSION,
    );

    for (let index = 0; index < next.length; index += 400) {
      const batch = adminDb.batch();
      next.slice(index, index + 400).forEach((summary) => {
        batch.set(user.collection("financialSummaries").doc(summary.id), summary);
      });
      await batch.commit();
    }
    return NextResponse.json({ updated: next.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof AuthenticationError ? "Authentication required." : "Financial summaries could not be rebuilt." },
      { status: error instanceof AuthenticationError ? 401 : 500 },
    );
  }
}
