"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronsUpDown, ListChecks, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategorizationRules } from "@/hooks/use-categorization-rules";
import { useCategories } from "@/hooks/use-categories";
import { useToast } from "@/hooks/use-toast";
import { useAllTransactions, useTransactionData } from "@/hooks/use-transactions";
import { useEnvelopes } from "@/hooks/use-envelopes";
import { isTransactionReviewable } from "@/lib/categorization";
import { cn } from "@/lib/utils";
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

interface CategoryPickerProps {
  disabled?: boolean;
  emptyMessage?: string;
  onValueChange: (value: string) => void;
  options: CategoryOption[];
  placeholder: string;
  value: string;
}

function CategoryPicker({
  disabled = false,
  emptyMessage = "No matching categories.",
  onValueChange,
  options,
  placeholder,
  value,
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-11 w-full justify-between px-3 font-normal md:h-10"
        >
          <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories…" />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.id}
                value={`${option.label} ${option.id}`}
                onSelect={() => {
                  onValueChange(option.id);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === option.id ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function NeedsCategorizationPage() {
  const { transactions, loading } = useAllTransactions({ respectAccountFilter: false });
  const { updateTransaction } = useTransactionData();
  const { categories, loading: categoriesLoading, error: categoriesError } = useCategories();
  const { getAccountName, activeAccounts } = useAccounts();
  const { activeEnvelopes } = useEnvelopes();
  const { rules, addRule, updateRule, deleteRule, applyRules } = useCategorizationRules();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingTransactionId, setSavingTransactionId] = useState<string | null>(null);
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

  const manualCategoryValues = (category: CategoryOption) => {
    const now = new Date().toISOString();
    return {
      categoryId: category.id,
      category: category.label,
      categorizationStatus: "manually-categorized" as const,
      categorizationSource: "manual" as const,
      classificationLocked: true,
      categorizedAt: now,
      reviewedAt: now,
      possibleTransfer: false,
    };
  };

  const categorizeOne = async (
    transactionId: string,
    transactionType: "income" | "expense" | "transfer",
    nextCategoryId: string,
  ) => {
    const category = options.find(
      (option) => option.id === nextCategoryId && option.type === transactionType,
    );
    if (!category) return;
    setSavingTransactionId(transactionId);
    try {
      await updateTransaction(transactionId, manualCategoryValues(category));
      toast({
        title: "Transaction categorized",
        description: `Assigned to ${category.label}.`,
      });
      setSelected((current) => current.filter((id) => id !== transactionId));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Transaction could not be updated",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSavingTransactionId(null);
    }
  };

  const categorizeSelected = async () => {
    const category = options.find((option) => option.id === categoryId);
    if (!category || selectedTransactions.length === 0 || mixedTypes || category.type !== selectedType) return;
    setSaving(true);
    try {
      for (const transaction of selectedTransactions) {
        await updateTransaction(transaction.id, manualCategoryValues(category));
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
                <CategoryPicker
                  value={categoryId}
                  onValueChange={setCategoryId}
                  options={options.filter((option) => !selectedType || option.type === selectedType)}
                  disabled={mixedTypes || selected.length === 0 || categoriesLoading || Boolean(categoriesError)}
                  placeholder={
                    mixedTypes
                      ? "Select only income or only expenses"
                      : selected.length === 0
                        ? "Select transactions below first"
                        : categoriesLoading
                          ? "Loading categories…"
                          : "Search for a category"
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {selected.length === 0
                    ? "Use the checkboxes for a bulk update, or choose a category directly on one transaction below."
                    : `${selected.length} transaction${selected.length === 1 ? "" : "s"} selected.`}
                </p>
              </div>
              <Button onClick={categorizeSelected} disabled={!categoryId || selected.length === 0 || mixedTypes || saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Categorize {selected.length || "selected"}</Button>
            </div>
          ) : null}
          {loading ? <p className="text-sm text-muted-foreground">Loading imported activity…</p> : null}
          {categoriesError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              Categories could not be loaded. Refresh this page, then check your <Link href="/categories" className="font-medium underline">Categories</Link> page if the problem continues.
            </div>
          ) : null}
          {!categoriesLoading && !categoriesError && options.length === 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              No categories are set up yet. <Link href="/categories" className="font-medium underline">Create categories</Link> before reviewing imported transactions.
            </div>
          ) : null}
          {!loading && reviewable.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-3 font-semibold">Everything is categorized</p><p className="mt-1 text-sm text-muted-foreground">New unmatched bank transactions will appear here after the next sync.</p></div>
          ) : null}
          <div className="space-y-2">
            {reviewable.map((transaction) => (
              <div key={transaction.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border p-3 hover:bg-secondary/30 sm:grid-cols-[auto_minmax(0,1fr)_minmax(12rem,18rem)_auto] sm:items-start">
                <Checkbox id={`review-${transaction.id}`} className="mt-1" checked={selected.includes(transaction.id)} onCheckedChange={(checked) => setSelected((current) => checked ? [...new Set([...current, transaction.id])] : current.filter((id) => id !== transaction.id))} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><Label htmlFor={`review-${transaction.id}`} className="cursor-pointer truncate font-medium">{transaction.description}</Label>{transaction.postingStatus === "pending" ? <Badge variant="outline">Pending</Badge> : null}{transaction.possibleTransfer ? <Badge variant="secondary">Possible transfer</Badge> : null}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{new Date(transaction.date).toLocaleDateString()} · {getAccountName(transaction.accountId)}{transaction.providerCategoryPrimary ? ` · ${transaction.providerCategoryPrimary.replaceAll("_", " ").toLowerCase()}` : ""}</p>
                  {transaction.possibleTransfer ? <Link href="/accounts" className="mt-1 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">Review transfer matches</Link> : null}
                </div>
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <CategoryPicker
                    value=""
                    onValueChange={(nextCategoryId) => void categorizeOne(transaction.id, transaction.type, nextCategoryId)}
                    options={options.filter((option) => option.type === transaction.type)}
                    disabled={categoriesLoading || Boolean(categoriesError) || savingTransactionId === transaction.id || transaction.type === "transfer"}
                    placeholder={savingTransactionId === transaction.id ? "Saving…" : categoriesLoading ? "Loading categories…" : "Choose category"}
                  />
                </div>
                <p className={`col-span-2 text-right font-semibold tabular-nums sm:col-span-1 sm:pt-2 ${transaction.type === "expense" ? "text-destructive" : "text-emerald-700"}`}>{transaction.type === "expense" ? "−" : "+"}{currency.format(transaction.amount)}</p>
              </div>
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
            <div className="space-y-1.5">
              <Label>Assign category</Label>
              <CategoryPicker
                value={ruleCategoryId}
                onValueChange={setRuleCategoryId}
                options={options.filter((option) => option.type === ruleType)}
                disabled={categoriesLoading || Boolean(categoriesError)}
                placeholder={categoriesLoading ? "Loading categories…" : `Search ${ruleType} categories`}
              />
              <p className="text-xs text-muted-foreground">The list follows the transaction type selected above.</p>
            </div>
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
