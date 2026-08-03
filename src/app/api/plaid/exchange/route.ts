import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withoutUndefined } from "@/lib/firestore-values";
import { plaidRequest } from "@/lib/plaid-client";
import { encryptPlaidAccessToken } from "@/lib/plaid-crypto";
import { plaidRouteError, requiredString } from "@/lib/plaid-route";
import { requireUid } from "@/lib/requireUid";
import type { PlaidAccountPayload } from "@/lib/plaid-mapping";
import type { PlaidAvailableAccount, PlaidItem } from "@/types";

export const runtime = "nodejs";

interface ExchangeResponse {
  access_token: string;
  item_id: string;
}

interface AccountsResponse {
  accounts: PlaidAccountPayload[];
  item?: { institution_id?: string | null };
}

export async function POST(request: Request) {
  try {
    const uid = await requireUid(request);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const body = (await request.json()) as Record<string, unknown>;
    const publicToken = requiredString(body.publicToken, "publicToken", 2000);
    const institution =
      body.institution && typeof body.institution === "object"
        ? (body.institution as Record<string, unknown>)
        : {};
    const exchange = await plaidRequest<ExchangeResponse>(
      "item/public_token/exchange",
      { public_token: publicToken },
    );
    const accounts = await plaidRequest<AccountsResponse>("accounts/get", {
      access_token: exchange.access_token,
    });
    const now = new Date().toISOString();
    const institutionId =
      (typeof institution.institution_id === "string"
        ? institution.institution_id
        : accounts.item?.institution_id) ?? null;
    const institutionName =
      typeof institution.name === "string" ? institution.name.slice(0, 160) : null;
    const availableAccounts: PlaidAvailableAccount[] = accounts.accounts.map(
      (account) => ({
        plaidAccountId: account.account_id,
        name: account.name,
        officialName: account.official_name ?? null,
        mask: account.mask ?? null,
        type: account.type,
        subtype: account.subtype ?? null,
        currentBalance: account.balances.current ?? null,
        availableBalance: account.balances.available ?? null,
        creditLimit: account.balances.limit ?? null,
        currency: account.balances.iso_currency_code ?? null,
      }),
    );
    const safeItem: PlaidItem = {
      id: exchange.item_id,
      plaidItemId: exchange.item_id,
      institutionId,
      institutionName,
      status: "connecting",
      availableAccounts,
      mappedAccountCount: 0,
      products: ["transactions"],
      createdAt: now,
      updatedAt: now,
    };
    const batch = adminDb.batch();
    batch.set(
      adminDb
        .collection("plaidSecrets")
        .doc(uid)
        .collection("items")
        .doc(exchange.item_id),
      {
        encryptedAccessToken: encryptPlaidAccessToken(exchange.access_token),
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    batch.set(adminDb.collection("plaidItemOwners").doc(exchange.item_id), {
      uid,
      createdAt: now,
      updatedAt: now,
    });
    batch.set(
      adminDb
        .collection("users")
        .doc(uid)
        .collection("plaidItems")
        .doc(exchange.item_id),
      withoutUndefined(safeItem),
      { merge: true },
    );
    await batch.commit();
    return NextResponse.json({ item: safeItem });
  } catch (error) {
    return plaidRouteError(error);
  }
}
