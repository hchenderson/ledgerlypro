"use client";

import { useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Loader2, RefreshCw, Unplug } from "lucide-react";

import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { usePlaid } from "@/hooks/use-plaid";
import { useToast } from "@/hooks/use-toast";
import type { PlaidItem } from "@/types";

function statusLabel(item: PlaidItem) {
  switch (item.status) {
    case "healthy": return "Connected";
    case "syncing": return "Syncing";
    case "needs-attention": return "Reconnect required";
    case "permission-expiring": return "Permission expiring";
    case "delayed": return "Sync delayed";
    case "disconnected": return "Disconnected";
    default: return "Connecting";
  }
}

function relativeTime(value?: string) {
  if (!value) return "Not synced yet";
  const elapsed = Date.now() - Date.parse(value);
  if (!Number.isFinite(elapsed) || elapsed < 0) return "Recently";
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} hr ago`;
  return `${Math.floor(elapsed / 86_400_000)} day${elapsed < 172_800_000 ? "" : "s"} ago`;
}

export function PlaidConnectionsCard({ compact = false }: { compact?: boolean }) {
  const plaid = usePlaid();
  const { toast } = useToast();
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [deleteImported, setDeleteImported] = useState(false);
  const connectedItems = plaid.items.filter((item) => item.status !== "disconnected");

  const sync = async (item: PlaidItem) => {
    setBusyItem(item.id);
    try {
      const result = await plaid.sync(item.plaidItemId);
      toast({ title: "Bank activity updated", description: `${Number(result.added ?? 0)} new and ${Number(result.modified ?? 0)} updated transactions were processed.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Sync could not finish", description: error instanceof Error ? error.message : "Try reconnecting the institution." });
    } finally {
      setBusyItem(null);
    }
  };

  const disconnect = async (item: PlaidItem) => {
    setBusyItem(item.id);
    try {
      await plaid.disconnect(item.plaidItemId, deleteImported);
      toast({ title: "Institution disconnected", description: deleteImported ? "Imported Plaid transactions were removed; your Ledgerly accounts remain." : "Existing transaction history was kept." });
      setDeleteImported(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Institution could not be disconnected", description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setBusyItem(null);
    }
  };

  const refreshBalances = async (item: PlaidItem) => {
    setBusyItem(item.id);
    try {
      const result = await plaid.refreshBalances(
        item.plaidItemId,
        plaid.config?.realTimeBalanceEnabled === true,
      );
      toast({
        title: result.cached ? "Balances are already current" : "Institution balances refreshed",
        description: plaid.config?.realTimeBalanceEnabled
          ? "A real-time balance check was requested."
          : "Cached balances were refreshed without a real-time Balance call.",
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Balances could not be refreshed", description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setBusyItem(null);
    }
  };

  return (
    <Card>
      <CardHeader className={compact ? "p-4 sm:p-6" : undefined}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Connected institutions</CardTitle>
            <CardDescription className="mt-1">Securely import balances and transactions. Ledgerly never stores your bank username or password.</CardDescription>
          </div>
          <PlaidLinkButton size="sm" />
        </div>
      </CardHeader>
      <CardContent className={`space-y-3 ${compact ? "px-4 pb-4 sm:px-6 sm:pb-6" : ""}`}>
        {plaid.config?.configured === false ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            Plaid is built into the app, but the deployment credentials still need to be added. See the Plaid setup section in the README.
          </div>
        ) : null}
        {!plaid.loading && connectedItems.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-center">
            <p className="font-medium">No bank is connected yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Connect an institution, then choose exactly which accounts Ledgerly should import.</p>
          </div>
        ) : null}
        {connectedItems.map((item) => {
          const needsAttention = item.status === "needs-attention" || item.status === "permission-expiring";
          return (
            <div key={item.id} className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {needsAttention ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  <p className="truncate font-semibold">{item.institutionName || "Connected institution"}</p>
                  <Badge variant={needsAttention ? "destructive" : "secondary"}>{statusLabel(item)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.mappedAccountCount ?? 0} mapped account{item.mappedAccountCount === 1 ? "" : "s"} · Last sync {relativeTime(item.lastSuccessfulSync)}
                </p>
                {item.errorMessage ? <p className="mt-1 text-sm text-destructive">{item.errorMessage}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {needsAttention ? <PlaidLinkButton reconnectItemId={item.plaidItemId} size="sm" variant="outline" /> : null}
                <Button variant="outline" size="sm" onClick={() => void sync(item)} disabled={busyItem === item.id}>
                  {busyItem === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Sync
                </Button>
                <Button variant="outline" size="sm" onClick={() => void refreshBalances(item)} disabled={busyItem === item.id}>
                  Refresh balances
                </Button>
                <AlertDialog onOpenChange={(open) => !open && setDeleteImported(false)}>
                  <AlertDialogTrigger asChild><Button variant="ghost" size="sm"><Unplug className="mr-2 h-4 w-4" /> Disconnect</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect {item.institutionName || "this institution"}?</AlertDialogTitle>
                      <AlertDialogDescription>Ledgerly will revoke this Plaid connection. You can keep imported history or remove only the transactions that came from this connection.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                      <Checkbox checked={deleteImported} onCheckedChange={(checked) => setDeleteImported(checked === true)} />
                      <span><strong>Delete imported Plaid transactions</strong><span className="mt-0.5 block text-muted-foreground">Manual transactions and your Ledgerly account records will stay.</span></span>
                    </label>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void disconnect(item)}>Disconnect</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
