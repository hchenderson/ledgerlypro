"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Edit3, Landmark, PlusCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import {
  type NewDesignatedFund,
  useDesignatedFunds,
} from "@/hooks/use-designated-funds";
import { useToast } from "@/hooks/use-toast";
import { useAllTransactions } from "@/hooks/use-transactions";
import {
  computeDesignatedFundResult,
  computeOperatingSummary,
} from "@/lib/designated-funds";
import type { Category, DesignatedFund, SubCategory } from "@/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function categoryOptions(
  categories: Category[],
  type: "income" | "expense",
) {
  const options: { label: string; value: string }[] = [];
  const walk = (items: (Category | SubCategory)[], parents: string[]) => {
    for (const item of items) {
      const path = [...parents, item.name];
      options.push({ label: path.join(" > "), value: item.id });
      if (item.subCategories) walk(item.subCategories, path);
    }
  };
  for (const category of categories.filter((item) => item.type === type)) {
    walk([category], []);
  }
  return options;
}

function FundDialog({
  fund,
  open,
  onOpenChange,
}: {
  fund?: DesignatedFund;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { activeYear } = useAuth();
  const { categories } = useCategories();
  const { addFund, updateFund } = useDesignatedFunds();
  const { toast } = useToast();
  const [name, setName] = useState(fund?.name ?? "");
  const [incomeCategoryIds, setIncomeCategoryIds] = useState(
    fund?.incomeCategoryIds ?? [],
  );
  const [expenseCategoryIds, setExpenseCategoryIds] = useState(
    fund?.expenseCategoryIds ?? [],
  );
  const [openingBalance, setOpeningBalance] = useState(
    String(fund?.openingBalance ?? 0),
  );
  const [openingBalanceDate, setOpeningBalanceDate] = useState(
    fund?.openingBalanceDate.slice(0, 10) ?? `${activeYear}-01-01`,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || incomeCategoryIds.length === 0 || expenseCategoryIds.length === 0) {
      setError("Enter a fund name and select at least one received and one sent category.");
      return;
    }
    const balance = Number(openingBalance);
    if (!Number.isFinite(balance) || !openingBalanceDate) {
      setError("Enter a valid opening balance and date.");
      return;
    }
    const values: NewDesignatedFund = {
      name: name.trim(),
      incomeCategoryIds,
      expenseCategoryIds,
      openingBalance: balance,
      openingBalanceDate: new Date(`${openingBalanceDate}T00:00:00`).toISOString(),
    };
    setSaving(true);
    setError(null);
    try {
      if (fund) await updateFund(fund.id, values);
      else await addFund(values);
      toast({
        title: fund ? "Designated fund updated" : "Designated fund created",
        description: `${values.name} will now be separated from church operations.`,
      });
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The fund could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{fund ? "Edit designated fund" : "Create designated fund"}</DialogTitle>
          <DialogDescription>
            Pair the categories used when money is received and sent. Ledgerly will calculate the amount held and remove both sides from church operations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="fund-name">Fund name</Label><Input id="fund-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Missionary Support" /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Received categories</Label><SearchableMultiSelect options={categoryOptions(categories, "income")} selected={incomeCategoryIds} onChange={setIncomeCategoryIds} placeholder="Select missionary income categories" /><p className="text-xs text-muted-foreground">Split-deposit lines assigned to these categories count as designated money received.</p></div>
          <div className="space-y-2 sm:col-span-2"><Label>Sent or spent categories</Label><SearchableMultiSelect options={categoryOptions(categories, "expense")} selected={expenseCategoryIds} onChange={setExpenseCategoryIds} placeholder="Select missionary expense categories" /></div>
          <div className="space-y-2"><Label htmlFor="fund-opening">Opening amount held</Label><Input id="fund-opening" type="number" step="0.01" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="fund-opening-date">Balance as of</Label><Input id="fund-opening-date" type="date" value={openingBalanceDate} onChange={(event) => setOpeningBalanceDate(event.target.value)} /></div>
        </div>
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save fund"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DesignatedFundsReport() {
  const { activeYear } = useAuth();
  const { transactions, loading: transactionsLoading } = useAllTransactions();
  const { funds, loading, deleteFund } = useDesignatedFunds();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DesignatedFund>();
  const [from, setFrom] = useState(`${activeYear}-01-01`);
  const [to, setTo] = useState(`${activeYear}-12-31`);
  useEffect(() => {
    setFrom(`${activeYear}-01-01`);
    setTo(`${activeYear}-12-31`);
  }, [activeYear]);
  const range = useMemo(
    () => {
      const first = new Date(`${from}T00:00:00`);
      const last = new Date(`${to}T23:59:59.999`);
      return first.getTime() <= last.getTime()
        ? { from: first, to: last }
        : { from: new Date(`${to}T00:00:00`), to: new Date(`${from}T23:59:59.999`) };
    },
    [from, to],
  );
  const applyPreset = (preset: string) => {
    const ranges: Record<string, [string, string]> = {
      full: [`${activeYear}-01-01`, `${activeYear}-12-31`],
      h1: [`${activeYear}-01-01`, `${activeYear}-06-30`],
      h2: [`${activeYear}-07-01`, `${activeYear}-12-31`],
      q1: [`${activeYear}-01-01`, `${activeYear}-03-31`],
      q2: [`${activeYear}-04-01`, `${activeYear}-06-30`],
      q3: [`${activeYear}-07-01`, `${activeYear}-09-30`],
      q4: [`${activeYear}-10-01`, `${activeYear}-12-31`],
    };
    const selected = ranges[preset];
    if (selected) {
      setFrom(selected[0]);
      setTo(selected[1]);
    }
  };
  const results = useMemo(
    () => funds.map((fund) => computeDesignatedFundResult(fund, transactions, range)),
    [funds, range, transactions],
  );
  const operating = useMemo(
    () => computeOperatingSummary(funds, transactions, range),
    [funds, range, transactions],
  );
  const received = results.reduce((sum, result) => sum + result.received, 0);
  const spent = results.reduce((sum, result) => sum + result.spent, 0);
  const held = results.reduce((sum, result) => sum + result.endingBalance, 0);

  if (loading || transactionsLoading) return <p className="text-muted-foreground">Loading designated funds…</p>;

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-secondary/20">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Church operations and designated funds</CardTitle><CardDescription>One combined bank deposit can be split into general and designated income without changing the account balance.</CardDescription></div>
          <Button onClick={() => setCreating(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add fund</Button>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Reporting period</CardTitle><CardDescription>Choose the exact dates you are reporting to the church.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2"><Label>Preset</Label><Select onValueChange={applyPreset}><SelectTrigger><SelectValue placeholder="Custom dates" /></SelectTrigger><SelectContent><SelectItem value="full">Full year</SelectItem><SelectItem value="h1">First half</SelectItem><SelectItem value="h2">Second half</SelectItem><SelectItem value="q1">Q1</SelectItem><SelectItem value="q2">Q2</SelectItem><SelectItem value="q3">Q3</SelectItem><SelectItem value="q4">Q4</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="designated-from">From</Label><Input id="designated-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="designated-to">To</Label><Input id="designated-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
        </CardContent>
      </Card>
      {funds.length === 0 ? (
        <Card><CardHeader><CardTitle>No designated funds configured</CardTitle><CardDescription>Create a fund, pair its received and sent categories, then split combined deposits from Transactions.</CardDescription></CardHeader></Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card><CardHeader><CardDescription>Church income</CardDescription><CardTitle>{currency.format(operating.income)}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Church spending</CardDescription><CardTitle>{currency.format(operating.expenses)}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Operating result</CardDescription><CardTitle>{currency.format(operating.net)}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Designated received</CardDescription><CardTitle>{currency.format(received)}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Designated held</CardDescription><CardTitle>{currency.format(held)}</CardTitle></CardHeader></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Designated fund activity</CardTitle><CardDescription>{format(range.from, "MMM d, yyyy")}–{format(range.to, "MMM d, yyyy")} · Opening + received − sent = ending amount held. The opening figure carries money across reporting periods.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Fund</TableHead><TableHead className="text-right">Opening</TableHead><TableHead className="text-right">Received</TableHead><TableHead className="text-right">Sent</TableHead><TableHead className="text-right">Change</TableHead><TableHead className="text-right">Ending held</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{results.map((result) => <TableRow key={result.fund.id}><TableCell><p className="font-medium">{result.fund.name}</p><p className="text-xs text-muted-foreground">Opening confirmed {format(new Date(result.fund.openingBalanceDate), "MMM d, yyyy")}</p></TableCell><TableCell className="text-right tabular-nums">{currency.format(result.openingBalance)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(result.received)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(result.spent)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(result.change)}</TableCell><TableCell className="text-right font-semibold tabular-nums">{currency.format(result.endingBalance)}</TableCell><TableCell><div className="flex justify-end"><Button variant="ghost" size="icon" onClick={() => setEditing(result.fund)} aria-label={`Edit ${result.fund.name}`}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => void deleteFund(result.fund.id).then(() => toast({ title: "Designated fund removed", description: "Transactions and categories were not deleted." }))} aria-label={`Delete ${result.fund.name}`}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">Designated funds received {currency.format(received)} and sent {currency.format(spent)} during this period. These amounts are excluded from the church operating cards above.</p>
        </>
      )}
      {creating ? <FundDialog open={creating} onOpenChange={setCreating} /> : null}
      {editing ? <FundDialog key={editing.id} fund={editing} open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(undefined); }} /> : null}
    </div>
  );
}
