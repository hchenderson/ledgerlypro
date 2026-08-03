import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";
import { withoutUndefined } from "@/lib/firestore-values";
import { accountClassificationForType, defaultAccountRoleForType } from "@/lib/accounts";
import { plaidAccountType } from "@/lib/plaid-mapping";
import { plaidRouteError, requiredString } from "@/lib/plaid-route";
import { requireUid } from "@/lib/requireUid";
import type { Account, AccountRole, PlaidItem } from "@/types";

export const runtime = "nodejs";

type MappingAction = "create" | "existing" | "ignore";

interface AccountMapping {
  plaidAccountId: string;
  action: MappingAction;
  accountId?: string;
  role?: AccountRole;
}

function stableAccountId(itemId: string, accountId: string) {
  return `plaid-account-${createHash("sha256")
    .update(`${itemId}:${accountId}`)
    .digest("hex")
    .slice(0, 24)}`;
}

export async function POST(request: Request) {
  try {
    const uid = await requireUid(request);
    if (!adminDb) throw new Error("Firebase Admin SDK is not initialized.");
    const body = (await request.json()) as Record<string, unknown>;
    const plaidItemId = requiredString(body.plaidItemId, "plaidItemId");
    const mappings = Array.isArray(body.mappings)
      ? (body.mappings as AccountMapping[])
      : [];
    if (mappings.length === 0) throw new Error("Select how each account should be handled.");
    if (mappings.filter((mapping) => mapping.action === "create" && mapping.role === "operating").length > 1) {
      throw new Error("Only one newly connected account can be the Main account.");
    }

    const userRef = adminDb.collection("users").doc(uid);
    const itemRef = userRef.collection("plaidItems").doc(plaidItemId);
    const itemSnapshot = await itemRef.get();
    if (!itemSnapshot.exists) throw new Error("Bank connection was not found.");
    const item = { ...itemSnapshot.data(), id: itemSnapshot.id } as PlaidItem;
    const availableById = new Map(
      (item.availableAccounts ?? []).map((account) => [account.plaidAccountId, account]),
    );
    const existingSnapshot = await userRef.collection("accounts").get();
    const existingById = new Map(existingSnapshot.docs.map((document) => [document.id, document]));
    const batch = adminDb.batch();
    const now = new Date().toISOString();
    let mappedCount = 0;

    for (const mapping of mappings) {
      if (!mapping || !["create", "existing", "ignore"].includes(mapping.action)) {
        throw new Error("An account mapping is invalid.");
      }
      const available = availableById.get(mapping.plaidAccountId);
      if (!available) throw new Error("A selected bank account is unavailable.");
      if (mapping.action === "ignore") continue;
      mappedCount += 1;
      const accountType = plaidAccountType(available.type, available.subtype);
      const values = {
        plaidItemId,
        plaidAccountId: available.plaidAccountId,
        institutionId: item.institutionId ?? undefined,
        institutionName: item.institutionName ?? undefined,
        institution: item.institutionName ?? undefined,
        institutionCurrentBalance: available.currentBalance ?? null,
        institutionAvailableBalance: available.availableBalance ?? null,
        institutionCreditLimit: available.creditLimit ?? null,
        institutionBalanceUpdatedAt: now,
        institutionBalanceIsRealtime: false,
        plaidConnectionStatus: "connecting" as const,
        lastFour: available.mask ?? undefined,
      };
      if (mapping.action === "existing") {
        const existingId = requiredString(mapping.accountId, "accountId");
        const existing = existingById.get(existingId);
        if (!existing) throw new Error("The selected Ledgerly account was not found.");
        const existingValues = existing.data() as Account;
        if (
          existingValues.plaidAccountId &&
          (existingValues.plaidAccountId !== available.plaidAccountId ||
            existingValues.plaidItemId !== plaidItemId)
        ) {
          throw new Error(`${existingValues.name} is already linked to another bank account.`);
        }
        batch.set(existing.ref, withoutUndefined(values), { merge: true });
        continue;
      }
      const id = stableAccountId(plaidItemId, available.plaidAccountId);
      const role = mapping.role ?? defaultAccountRoleForType(accountType);
      const account: Account = {
        id,
        name: available.officialName || available.name,
        type: accountType,
        classification: accountClassificationForType(accountType),
        openingBalance: 0,
        currency: "USD",
        role,
        isArchived: false,
        isDefault: role === "operating",
        createdAt: now,
        openingBalanceEstimated: true,
        ...values,
      };
      batch.set(
        userRef.collection("accounts").doc(id),
        withoutUndefined(account),
        { merge: true },
      );
      if (role === "operating") {
        existingSnapshot.docs.forEach((document) => {
          if (document.id !== id && document.data().isDefault) {
            batch.set(document.ref, { isDefault: false }, { merge: true });
          }
        });
        batch.set(
          userRef.collection("settings").doc("main"),
          { primaryAccountId: id },
          { merge: true },
        );
      }
    }
    batch.set(
      itemRef,
      {
        mappedAccountCount: mappedCount,
        historyScope:
          typeof body.historyScope === "string" ? body.historyScope.slice(0, 40) : "available",
        status: mappedCount > 0 ? "syncing" : "healthy",
        updatedAt: now,
      },
      { merge: true },
    );
    await batch.commit();
    return NextResponse.json({ plaidItemId, mappedCount });
  } catch (error) {
    return plaidRouteError(error);
  }
}
