"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CalendarCheck, Eye, MailPlus, ShieldCheck, UserRoundX, UsersRound } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useBudgets } from "@/hooks/use-budgets";
import { useCategories } from "@/hooks/use-categories";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { findCategoryWithPathById } from "@/lib/category-tree";
import type { BudgetPortalGrant, BudgetPortalSummaryResponse } from "@/lib/budget-portal-types";

type AccessResponse = { grants: BudgetPortalGrant[]; reviewedThrough: string | null; error?: string };

export default function BudgetAccessPage() {
  const { user } = useAuth();
  const { budgets } = useBudgets();
  const { categories } = useCategories();
  const [grants, setGrants] = useState<BudgetPortalGrant[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewedThrough, setReviewedThrough] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<BudgetPortalGrant | null>(null);
  const [preview, setPreview] = useState<BudgetPortalSummaryResponse | null>(null);

  const budgetOptions = useMemo(() => budgets
    .map((budget) => {
      const category = findCategoryWithPathById(budget.categoryId, categories);
      return { budget, label: category?.path.map((item) => item.name).join(" > ") ?? "Unknown category" };
    })
    .sort((a, b) => b.budget.year - a.budget.year || a.label.localeCompare(b.label)), [budgets, categories]);

  const load = useCallback(async () => {
    if (!user) return;
    const response = await authenticatedFetch(user, "/api/budget-portal/access", { cache: "no-store" });
    const data = await response.json() as AccessResponse;
    if (!response.ok) throw new Error(data.error || "Budget access could not be loaded.");
    setGrants(data.grants);
    setReviewedThrough(data.reviewedThrough ?? "");
  }, [user]);

  useEffect(() => { void load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Budget access could not be loaded.")); }, [load]);

  const toggleBudget = (id: string, current: string[], update: (value: string[]) => void) => update(current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const call = async (method: "POST" | "PATCH", body: unknown) => {
    if (!user) throw new Error("Sign in again.");
    const response = await authenticatedFetch(user, "/api/budget-portal/access", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Budget access could not be updated.");
    return data;
  };

  const invite = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const data = await call("POST", { email, displayName: displayName || null, budgetIds: selected });
      setNotice(data.invitationDelivery === "sent" ? "Access saved and the invitation email was sent." : "Access was saved, but the invitation email was not delivered. Check the email provider before asking the leader to request a code.");
      setEmail(""); setDisplayName(""); setSelected([]);
      await load();
    } catch (inviteError) { setError(inviteError instanceof Error ? inviteError.message : "Invitation could not be saved."); }
    finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true); setError(null);
    try { await call("PATCH", { action: "update", grantId: editing.id, displayName: editing.displayName, budgetIds: editing.budgetIds }); setEditing(null); await load(); }
    catch (editError) { setError(editError instanceof Error ? editError.message : "Assignment could not be updated."); }
    finally { setBusy(false); }
  };

  const revoke = async (grant: BudgetPortalGrant) => {
    if (!window.confirm(`Revoke ${grant.email}'s Budget Portal access? Their next refresh will remove the data.`)) return;
    setBusy(true); setError(null);
    try { await call("PATCH", { action: "revoke", grantId: grant.id }); await load(); }
    catch (revokeError) { setError(revokeError instanceof Error ? revokeError.message : "Access could not be revoked."); }
    finally { setBusy(false); }
  };

  const saveReviewedThrough = async () => {
    setBusy(true); setError(null);
    try { await call("PATCH", { action: "reviewed-through", reviewedThrough: reviewedThrough || null }); setNotice("Reviewed-through date saved for the entire ledger."); }
    catch (reviewError) { setError(reviewError instanceof Error ? reviewError.message : "Review date could not be saved."); }
    finally { setBusy(false); }
  };

  const openPreview = async (ids = selected) => {
    setBusy(true); setError(null);
    try { setPreview(await call("PATCH", { action: "preview", budgetIds: ids }) as BudgetPortalSummaryResponse); }
    catch (previewError) { setError(previewError instanceof Error ? previewError.message : "Preview could not be loaded."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-medium text-primary">Settings</p><h1 className="flex items-center gap-2 font-headline text-2xl font-bold tracking-tight"><UsersRound className="h-6 w-6" /> Budget Access</h1><p className="mt-1 text-muted-foreground">Give church leaders read-only access to specific budget summaries. They never receive transaction, donor, payroll, receipt, or bank details.</p></div>
      {error ? <Alert variant="destructive"><AlertTitle>Could not complete that action</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {notice ? <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Budget access updated</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert> : null}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MailPlus className="h-5 w-5" /> Invite a leader</CardTitle><CardDescription>The leader requests a single-use six-digit code from the normal sign-in page. Codes expire after 10 minutes.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="leader-email">Email</Label><Input id="leader-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="leader-name">Display name (optional)</Label><Input id="leader-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div></div>
          <BudgetChoices options={budgetOptions} value={selected} onToggle={(id) => toggleBudget(id, selected, setSelected)} />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" className="h-11" disabled={selected.length === 0 || busy} onClick={() => void openPreview()}><Eye className="mr-2 h-4 w-4" /> Preview permitted summary</Button><Button className="h-11" disabled={!email || selected.length === 0 || busy} onClick={() => void invite()}>{busy ? "Saving…" : "Grant access"}</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5" /> Transaction completeness</CardTitle><CardDescription>Reviewed through applies to the entire ledger and is shown separately from bank sync and calculation times. Set it only after you have reviewed activity through that date.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="w-full space-y-2 sm:max-w-xs"><Label htmlFor="reviewed-through">Reviewed through</Label><Input id="reviewed-through" type="date" value={reviewedThrough} onChange={(event) => setReviewedThrough(event.target.value)} /></div><Button variant="outline" className="h-11" disabled={busy} onClick={() => void saveReviewedThrough()}>Save review date</Button></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Leaders with budget access</CardTitle><CardDescription>Revocation takes effect on the leader’s next request or automatic refresh.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {grants.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No leaders have been invited.</p> : grants.map((grant) => (
            <div key={grant.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-medium">{grant.displayName || grant.email}</p><Badge variant={grant.status === "revoked" ? "destructive" : grant.status === "active" ? "default" : "secondary"}>{grant.status}</Badge></div><p className="truncate text-sm text-muted-foreground">{grant.email} · {grant.budgetIds.length} budget{grant.budgetIds.length === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-muted-foreground">{grant.lastSuccessfulPortalSignIn ? `Last portal sign-in ${formatDistanceToNow(new Date(grant.lastSuccessfulPortalSignIn), { addSuffix: true })}` : "No successful portal sign-in yet"}</p></div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className="h-10" disabled={grant.status === "revoked" || busy} onClick={() => void openPreview(grant.budgetIds)}><Eye className="mr-2 h-4 w-4" /> Preview</Button><Button variant="outline" size="sm" className="h-10" disabled={grant.status === "revoked" || busy} onClick={() => setEditing({ ...grant, budgetIds: [...grant.budgetIds] })}>Edit</Button><Button variant="ghost" size="sm" className="h-10 text-destructive" disabled={grant.status === "revoked" || busy} onClick={() => void revoke(grant)}><UserRoundX className="mr-2 h-4 w-4" /> Revoke</Button></div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}><DialogContent><DialogHeader><DialogTitle>Edit budget assignment</DialogTitle><DialogDescription>Changes take effect on the leader’s next portal refresh.</DialogDescription></DialogHeader>{editing ? <div className="space-y-4"><div className="space-y-2"><Label>Display name</Label><Input value={editing.displayName ?? ""} onChange={(event) => setEditing({ ...editing, displayName: event.target.value || null })} /></div><BudgetChoices options={budgetOptions} value={editing.budgetIds} onToggle={(id) => setEditing({ ...editing, budgetIds: editing.budgetIds.includes(id) ? editing.budgetIds.filter((value) => value !== id) : [...editing.budgetIds, id] })} /></div> : null}<DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy || !editing?.budgetIds.length} onClick={() => void saveEdit()}>Save assignment</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Leader preview</DialogTitle><DialogDescription>This is the summary the portal is permitted to return. Parent and child cards can overlap and are never totaled together.</DialogDescription></DialogHeader><div className="space-y-3">{preview?.budgets.map((budget) => <div key={budget.id} className="rounded-xl border p-4"><div className="flex justify-between gap-4"><div><p className="font-medium">{budget.name}</p><p className="text-xs text-muted-foreground">{budget.periodLabel}</p></div><p className={budget.overBudget ? "font-semibold text-destructive" : "font-semibold"}>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.remainingMinor / 100)} left</p></div><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><p>Budget: {(budget.budgetedMinor / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}</p><p>Recorded: {(budget.spendingMinor / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}</p></div></div>)}</div></DialogContent></Dialog>
    </div>
  );
}

function BudgetChoices({ options, value, onToggle }: { options: Array<{ budget: { id: string; year: number; period: string }; label: string }>; value: string[]; onToggle: (id: string) => void }) {
  return <div className="space-y-2"><Label>Assigned budgets</Label><div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-3">{options.length === 0 ? <p className="text-sm text-muted-foreground">Create a budget before granting access.</p> : options.map(({ budget, label }) => <label key={budget.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-muted"><Checkbox checked={value.includes(budget.id)} onCheckedChange={() => onToggle(budget.id)} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{budget.year} · {budget.period}</span></span></label>)}</div></div>;
}
