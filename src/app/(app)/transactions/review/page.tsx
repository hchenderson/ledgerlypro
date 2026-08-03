"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, ListChecks, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategorizationRules } from "@/hooks/use-categorization-rules";
import { useCategories } from "@/hooks/use-categories";
import { useToast } from "@/hooks/use-toast";
import { useAllTransactions, useTransactionData } from "@/hooks/use-transactions";
import { useEnvelopes } from "@/hooks/use-envelopes";
import { isTransactionReviewable } from "@/lib/categorization";
import type { Category, SubCategory } from "@/types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

interface CategoryOption {
  id: string;
  label: string;
  type: "income" | "expense";
}

function flattenCategories(categories: Category[]) {
  const result: CategoryOption[] = [];
  const walk = (items: (Category | SubCategory)[], type: "income" | "expense", parents: string[] = []) => {
    items.forEach((item) => {
      const path = [...parents, item.name];
      result.push({ id: item.id, label: path.join(" > "), type });
      if (item.subCategories) walk(item.subCategories, type, path);
    });
  };
  categories.forEach((category) => walk([category], category.type));
  return result;
}

export default function NeedsCategorizationPage() {
  const { transactions, loading } = useAllTransactions({ respectAccountFilter: false });
  const { updateTransaction } = useTransactionData();
  const { categories } = useCategories();
  const { getAccountName, activeAccounts } = useAccounts();
  const { activeEnvelopes } = useEnvelopes();
  const { rules, addRule, updateRule, deleteRule, applyRules } = useCategorizationRules();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [merchantText, setMerchantText] = useState("");
  const [ruleType, setRuleType] = useState<"expense" | "income">("expense");
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [ruleMatchField, setRuleMatchField] = useState<"merchant" | "description">("merchant");
  const [ruleOperator, setRuleOperator] = useState<"contains" | "exact">("contains");
  const [ruleAccountId, setRuleAccountId] = useState("all");
  const [ruleMinimum, setRuleMinimum] = useState("");
  const [ruleMaximum, setRuleMaximum] = useState("");
  const [ruleProviderCategory, setRuleProviderCategory] = useState("");
  const [ruleEnvelopeId, setRuleEnvelopeId] = useState("none");
  const [rulePriority, setRulePriority] = useState("100");
  const [ruleMarkReviewed, setRuleMarkReviewed] = useState(true);

  const reviewable = useMemo(() => transactions.filter(isTransactionReviewable), [transactions]);
  const options = useMemo(() => flattenCategories(categories), [categories]);
  const selectedTransactions = reviewable.filter((transaction) => selected.includes(transaction.id));
  const selectedType = selectedTransactions[0]?.type;
  const mixedTypes = selectedTransactions.some((transaction) => transaction.type !== selectedType);

  const categorizeSelected = async () => {
    const category = options.find((option) => option.id === categoryId);
    if (!category || selectedTransactions.length === 0 || mixedTypes || category.type !== selectedType) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      for (const transaction of selectedTransactions) {
        await updateTransaction(transaction.id, {
          categoryId: category.id,
          category: category.label,
          categorizationStatus: "manually-categorized",
          categorizationSource: "manual",
          classificationLocked: true,
          categorizedAt: now,
          reviewedAt: now,
          possibleTransfer: false,
        });
      }
      toast({ title: "Transactions categorized", description: `${selectedTransactions.length} transaction${selectedTransactions.length === 1 ? " was" : "s were"} updated.` });
      setSelected([]);
      setCategoryId("");
    } catch (error) {
      toast({ variant: "destructive", title: "Transactions could not be updated", description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setSaving(false);
    }
  };

  const createRule = async () => {
    const category = options.find((option) => option.id === ruleCategoryId && option.type === ruleType);
    if (!ruleName.trim() || !merchantText.trim() || !category) return;
    setSaving(true);
    try {
      await addRule({
        name: ruleName.trim(),
        enabled: true,
        priority: Number(rulePriority) || 100,
        conditions: {
          direction: ruleType,
          ...(ruleAccountId !== "all" ? { accountIds: [ruleAccountId] } : {}),
          ...(ruleMatchField === "merchant"
            ? { merchantMatch: { operator: ruleOperator, value: merchantText.trim() } }
            : { descriptionMatch: { operator: ruleOperator, value: merchantText.trim() } }),
          ...(ruleProviderCategory.trim()
            ? { providerCategoryDetailed: ruleProviderCategory.trim().toUpperCase() }
            : {}),
          ...(ruleMinimum.trim() && Number.isFinite(Number(ruleMinimum))
            ? { minimumAmount: Math.max(0, Number(ruleMinimum)) }
            : {}),
          ...(ruleMaximum.trim() && Number.isFinite(Number(ruleMaximum))
            ? { maximumAmount: Math.max(0, Number(ruleMaximum)) }
            : {}),
        },
        actions: {
          categoryId: category.id,
          categoryName: category.label,
          ...(ruleEnvelopeId !== "none" ? { envelopeId: ruleEnvelopeId } : {}),
          markReviewed: ruleMarkReviewed,
        },
      });
      const result = await applyRules();
      toast({ title: "Rule created", description: `${Number(result.updated ?? 0)} existing transaction${Number(result.updated ?? 0) === 1 ? " was" : "s were"} categorized. Future imports will use it automatically.` });
      setRuleName("");
      setMerchantText("");
      setRuleCategoryId("");
      setRuleMinimum("");
      setRuleMaximum("");
      setRuleProviderCategory("");
      setRuleEnvelopeId("none");
    } catch (error) {
      toast({ variant: "destructive", title: "Rule could not be created", description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-headline text-2xl font-bold tracking-tight sm:text-3xl"><ListChecks className="h-7 w-7" /> Needs categorization</h1>
          <p className="mt-1 text-muted-foreground">Review imported activity, confirm possible transfers, and teach Ledgerly your rules.</p>
        </div>
        <Button variant="outline" asChild><Link href="/transactions">Back to transactions</Link></Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{reviewable.length} transaction{reviewable.length === 1 ? "" : "s"} to review</CardTitle>
          <CardDescription>Pending items can be categorized now, but they will not affect reports, balances, or envelope spending until they post.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reviewable.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-xl border bg-secondary/30 p-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label>Category for selected transactions</Label>
                <Select value={categoryId} onValueChange={setCategoryId} disabled={mixedTypes || selected.length === 0}>
                  <SelectTrigger><SelectValue placeholder={mixedTypes ? "Select only income or only expenses" : "Choose a category"} /></SelectTrigger>
                  <SelectContent>
                    {options.filter((option) => !selectedType || option.type === selectedType).map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={categorizeSelected} disabled={!categoryId || selected.length === 0 || mixedTypes || saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Categorize {selected.length || "selected"}</Button>
            </div>
          ) : null}
          {loading ? <p className="text-sm text-muted-foreground">Loading imported activity…</p> : null}
          {!loading && reviewable.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-3 font-semibold">Everything is categorized</p><p className="mt-1 text-sm text-muted-foreground">New unmatched bank transactions will appear here after the next sync.</p></div>
          ) : null}
          <div className="space-y-2">
            {reviewable.map((transaction) => (
              <label key={transaction.id} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-secondary/30">
                <Checkbox className="mt-1" checked={selected.includes(transaction.id)} onCheckedChange={(checked) => setSelected((current) => checked ? [...new Set([...current, transaction.id])] : current.filter((id) => id !== transaction.id))} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="truncate font-medium">{transaction.description}</p>{transaction.postingStatus === "pending" ? <Badge variant="outline">Pending</Badge> : null}{transaction.possibleTransfer ? <Badge variant="secondary">Possible transfer</Badge> : null}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{new Date(transaction.date).toLocaleDateString()} · {getAccountName(transaction.accountId)}{transaction.providerCategoryPrimary ? ` · ${transaction.providerCategoryPrimary.replaceAll("_", " ").toLowerCase()}` : ""}</p>
                  {transaction.possibleTransfer ? <Link href="/accounts" className="mt-1 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">Review transfer matches</Link> : null}
                </div>
                <p className={`font-semibold tabular-nums ${transaction.type === "expense" ? "text-destructive" : "text-emerald-700"}`}>{transaction.type === "expense" ? "−" : "+"}{currency.format(transaction.amount)}</p>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Automatic categorization rules</CardTitle>
          <CardDescription>Rules are evaluated by priority and specificity. A user-confirmed category is locked and always wins over Plaid or a later rule.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="rule-name">Rule name</Label><Input id="rule-name" value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder="Coffee shops" /></div>
            <div className="space-y-1.5"><Label>Match field</Label><Select value={ruleMatchField} onValueChange={(value) => setRuleMatchField(value as "merchant" | "description")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="merchant">Merchant</SelectItem><SelectItem value="description">Description</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Match style</Label><Select value={ruleOperator} onValueChange={(value) => setRuleOperator(value as "contains" | "exact")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="contains">Contains</SelectItem><SelectItem value="exact">Exact match</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="merchant-text">Text to match</Label><Input id="merchant-text" value={merchantText} onChange={(event) => setMerchantText(event.target.value)} placeholder="STARBUCKS" /></div>
            <div className="space-y-1.5"><Label>Transaction type</Label><Select value={ruleType} onValueChange={(value) => { setRuleType(value as "expense" | "income"); setRuleCategoryId(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">Expense</SelectItem><SelectItem value="income">Income</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Assign category</Label><Select value={ruleCategoryId} onValueChange={setRuleCategoryId}><SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger><SelectContent>{options.filter((option) => option.type === ruleType).map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Account</Label><Select value={ruleAccountId} onValueChange={setRuleAccountId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Every account</SelectItem>{activeAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Assign envelope (optional)</Label><Select value={ruleEnvelopeId} onValueChange={setRuleEnvelopeId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No envelope</SelectItem>{activeEnvelopes.map((envelope) => <SelectItem key={envelope.id} value={envelope.id}>{envelope.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="minimum-amount">Minimum amount</Label><Input id="minimum-amount" type="number" min="0" step="0.01" value={ruleMinimum} onChange={(event) => setRuleMinimum(event.target.value)} placeholder="Any" /></div>
            <div className="space-y-1.5"><Label htmlFor="maximum-amount">Maximum amount</Label><Input id="maximum-amount" type="number" min="0" step="0.01" value={ruleMaximum} onChange={(event) => setRuleMaximum(event.target.value)} placeholder="Any" /></div>
            <div className="space-y-1.5"><Label htmlFor="provider-category">Plaid detailed category (optional)</Label><Input id="provider-category" value={ruleProviderCategory} onChange={(event) => setRuleProviderCategory(event.target.value)} placeholder="FOOD_AND_DRINK_COFFEE" /></div>
            <div className="space-y-1.5"><Label htmlFor="rule-priority">Priority</Label><Input id="rule-priority" type="number" value={rulePriority} onChange={(event) => setRulePriority(event.target.value)} /></div>
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3 lg:col-span-2"><span><span className="font-medium">Mark matches reviewed</span><span className="block text-sm text-muted-foreground">Turn this off to keep automatic matches in the review inbox.</span></span><Switch checked={ruleMarkReviewed} onCheckedChange={setRuleMarkReviewed} /></label>
            <div className="md:col-span-2 lg:col-span-3"><Button onClick={createRule} disabled={saving || !ruleName.trim() || !merchantText.trim() || !ruleCategoryId}><Plus className="mr-2 h-4 w-4" /> Create and apply rule</Button></div>
          </div>
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-medium">{rule.name}</p><p className="text-sm text-muted-foreground">{rule.conditions.merchantMatch ? `Merchant ${rule.conditions.merchantMatch.operator} “${rule.conditions.merchantMatch.value}”` : "Custom rule"} → {rule.actions.categoryName}</p></div>
                <div className="flex items-center gap-3"><Switch checked={rule.enabled} aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`} onCheckedChange={(enabled) => void updateRule(rule.id, { enabled })} /><Button variant="ghost" size="icon" aria-label={`Delete ${rule.name}`} onClick={() => void deleteRule(rule.id)}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            ))}
            {rules.length === 0 ? <p className="text-sm text-muted-foreground">No rules yet. Create one above or categorize transactions manually.</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
