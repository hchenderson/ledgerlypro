"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/hooks/use-accounts";
import { usePlaid, type PlaidAccountMapping } from "@/hooks/use-plaid";
import { useToast } from "@/hooks/use-toast";
import type { AccountRole, PlaidItem } from "@/types";

declare global {
  interface Window {
    Plaid?: {
      create: (options: {
        token: string;
        onSuccess: (
          publicToken: string,
          metadata: { institution?: { institution_id?: string; name?: string } },
        ) => void;
        onExit: (error?: { display_message?: string; error_message?: string } | null) => void;
      }) => { open: () => void; destroy: () => void };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadPlaidScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Plaid) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-ledgerly-plaid]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Plaid Link could not load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    script.dataset.ledgerlyPlaid = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Plaid Link could not load."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function defaultRole(type: string, subtype?: string | null): AccountRole {
  if (type === "credit") return "debt";
  if (subtype === "savings" || subtype === "money market") return "envelope";
  return "standard";
}

export function PlaidLinkButton({
  reconnectItemId,
  size = "default",
  variant = "default",
}: {
  reconnectItemId?: string;
  size?: "default" | "sm";
  variant?: "default" | "outline";
}) {
  const plaid = usePlaid();
  const { activeAccounts } = useAccounts();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [mappingItem, setMappingItem] = useState<PlaidItem | null>(null);
  const [mappingSelections, setMappingSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!mappingItem) return;
    setMappingSelections(
      Object.fromEntries(
        (mappingItem.availableAccounts ?? []).map((account) => [
          account.plaidAccountId,
          `create:${defaultRole(account.type, account.subtype)}`,
        ]),
      ),
    );
  }, [mappingItem]);

  const canConnect = plaid.config?.configured !== false;
  const mappingCount = useMemo(
    () => Object.values(mappingSelections).filter((value) => value !== "ignore").length,
    [mappingSelections],
  );

  const openLink = async () => {
    setBusy(true);
    try {
      await loadPlaidScript();
      const token = await plaid.createLinkToken(reconnectItemId);
      const handler = window.Plaid?.create({
        token,
        onSuccess: (publicToken, metadata) => {
          void (async () => {
            try {
              if (reconnectItemId) {
                await plaid.sync(reconnectItemId);
                toast({ title: "Institution reconnected", description: "Ledgerly is syncing the latest activity." });
              } else {
                const item = await plaid.exchangePublicToken(publicToken, metadata.institution);
                setMappingItem(item);
              }
            } catch (error) {
              toast({ variant: "destructive", title: "Connection could not finish", description: error instanceof Error ? error.message : "Try again." });
            } finally {
              setBusy(false);
              handler?.destroy();
            }
          })();
        },
        onExit: (error) => {
          setBusy(false);
          handler?.destroy();
          if (error) {
            toast({ variant: "destructive", title: "Bank connection closed", description: error.display_message || error.error_message || "You can try again whenever you are ready." });
          }
        },
      });
      if (!handler) throw new Error("Plaid Link is unavailable.");
      handler.open();
    } catch (error) {
      setBusy(false);
      toast({ variant: "destructive", title: "Bank connection unavailable", description: error instanceof Error ? error.message : "Try again." });
    }
  };

  const finishMapping = async () => {
    if (!mappingItem) return;
    setBusy(true);
    try {
      const mappings: PlaidAccountMapping[] = (mappingItem.availableAccounts ?? []).map((account) => {
        const selected = mappingSelections[account.plaidAccountId] ?? "ignore";
        if (selected === "ignore") return { plaidAccountId: account.plaidAccountId, action: "ignore" };
        if (selected.startsWith("existing:")) return { plaidAccountId: account.plaidAccountId, action: "existing", accountId: selected.slice("existing:".length) };
        return { plaidAccountId: account.plaidAccountId, action: "create", role: selected.slice("create:".length) as AccountRole };
      });
      await plaid.mapAccounts(mappingItem.plaidItemId, mappings);
      if (mappingCount > 0) await plaid.sync(mappingItem.plaidItemId);
      toast({ title: "Bank accounts connected", description: `${mappingCount} account${mappingCount === 1 ? " is" : "s are"} now syncing with Ledgerly.` });
      setMappingItem(null);
    } catch (error) {
      toast({ variant: "destructive", title: "Accounts could not be prepared", description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="button" size={size} variant={variant} onClick={openLink} disabled={busy || !canConnect}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : reconnectItemId ? <RefreshCw className="mr-2 h-4 w-4" /> : <Building2 className="mr-2 h-4 w-4" />}
        {reconnectItemId ? "Reconnect" : canConnect ? "Connect bank" : "Plaid setup required"}
      </Button>

      <Dialog open={Boolean(mappingItem)} onOpenChange={(open) => !open && !busy && setMappingItem(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose where each bank account belongs</DialogTitle>
            <DialogDescription>
              Create a new Ledgerly account, link to one you already made, or leave an account out. This prevents duplicate balances.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(mappingItem?.availableAccounts ?? []).map((account) => (
              <div key={account.plaidAccountId} className="grid gap-2 rounded-xl border p-4 sm:grid-cols-[1fr_16rem] sm:items-center">
                <div>
                  <p className="font-semibold">{account.officialName || account.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {account.subtype || account.type}{account.mask ? ` •••• ${account.mask}` : ""}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="sr-only">Mapping for {account.name}</Label>
                  <Select value={mappingSelections[account.plaidAccountId]} onValueChange={(value) => setMappingSelections((current) => ({ ...current, [account.plaidAccountId]: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create:standard">Create standard account</SelectItem>
                      <SelectItem value="create:operating">Create main account</SelectItem>
                      <SelectItem value="create:envelope">Create envelope account</SelectItem>
                      <SelectItem value="create:debt">Create debt account</SelectItem>
                      {activeAccounts.map((existing) => (
                        <SelectItem key={existing.id} value={`existing:${existing.id}`}>Link to {existing.name}</SelectItem>
                      ))}
                      <SelectItem value="ignore">Do not import</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingItem(null)} disabled={busy}>Cancel</Button>
            <Button onClick={finishMapping} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {mappingCount} account{mappingCount === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
