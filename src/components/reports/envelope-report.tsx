"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  CheckCircle2,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useEnvelopes } from "@/hooks/use-envelopes";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function EnvelopeReportView() {
  const { activeYear } = useAuth();
  const { activeEnvelopes, getSummaries, loading } = useEnvelopes();
  const yearStart = new Date(activeYear, 0, 1);
  const yearEnd = new Date(activeYear, 11, 31);
  const summaries = getSummaries({ from: yearStart, to: yearEnd });
  const monthly = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) => {
        const monthSummaries = getSummaries({
          from: new Date(activeYear, month, 1),
          to: new Date(activeYear, month + 1, 0),
        });
        return {
          label: new Date(activeYear, month, 1).toLocaleDateString(
            "en-US",
            { month: "short" },
          ),
          funded: monthSummaries.reduce(
            (total, summary) => total + summary.funded,
            0,
          ),
          spent: monthSummaries.reduce(
            (total, summary) => total + summary.spent,
            0,
          ),
          released: monthSummaries.reduce(
            (total, summary) => total + summary.released,
            0,
          ),
          endingAvailable: monthSummaries.reduce(
            (total, summary) => total + summary.available,
            0,
          ),
        };
      }),
    [activeYear, getSummaries],
  );
  const funded = summaries.reduce(
    (total, summary) => total + summary.funded,
    0,
  );
  const spent = summaries.reduce(
    (total, summary) => total + summary.spent,
    0,
  );
  const available = summaries.reduce(
    (total, summary) => total + summary.available,
    0,
  );
  const pendingCommitted = summaries.reduce(
    (total, summary) => total + summary.pendingCommitted,
    0,
  );
  const released = summaries.reduce(
    (total, summary) => total + summary.released,
    0,
  );
  const quarterly = Array.from({ length: 4 }, (_, quarter) => {
    const quarterMonths = monthly.slice(quarter * 3, quarter * 3 + 3);
    return {
      label: `Q${quarter + 1}`,
      funded: quarterMonths.reduce((total, month) => total + month.funded, 0),
      released: quarterMonths.reduce((total, month) => total + month.released, 0),
      spent: quarterMonths.reduce((total, month) => total + month.spent, 0),
      endingAvailable: quarterMonths.at(-1)?.endingAvailable ?? 0,
    };
  });

  if (loading) return <p className="text-muted-foreground">Loading envelope report…</p>;
  if (activeEnvelopes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No envelope activity</CardTitle>
          <CardDescription>
            Set up an envelope on the Budgets page to begin purpose-based reporting.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-secondary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" /> Envelope performance for {activeYear}</CardTitle>
          <CardDescription>
            This report measures assigned money. Transfers remain excluded from the standard income, expense, and net-income reports.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardHeader><CardDescription>Funded</CardDescription><CardTitle>{currency.format(funded)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Spent</CardDescription><CardTitle>{currency.format(spent)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Released to Main</CardDescription><CardTitle>{currency.format(released)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Ending available</CardDescription><CardTitle>{currency.format(available)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Pending commitments</CardDescription><CardTitle>{currency.format(pendingCommitted)}</CardTitle></CardHeader></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Envelope results</CardTitle><CardDescription>Planned targets compared with available assigned money.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Envelope</TableHead><TableHead className="text-right">Funded</TableHead><TableHead className="text-right">Spent</TableHead><TableHead className="text-right">Available</TableHead><TableHead className="text-right">Target gap</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {summaries.map((summary) => (
                <TableRow key={summary.envelope.id}>
                  <TableCell className="font-medium">{summary.envelope.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{currency.format(summary.funded)}</TableCell>
                  <TableCell className="text-right tabular-nums">{currency.format(summary.spent)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${summary.available < 0 ? "text-destructive" : ""}`}>{currency.format(summary.available)}</TableCell>
                  <TableCell className="text-right tabular-nums">{currency.format(summary.targetGap)}</TableCell>
                  <TableCell><Badge variant={summary.status === "overspent" ? "destructive" : summary.status === "underfunded" ? "outline" : "secondary"}>{summary.status === "overspent" ? <AlertTriangle className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}{summary.status === "healthy" ? "On track" : summary.status === "underfunded" ? "Underfunded" : "Overspent"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Quarterly envelope performance</CardTitle><CardDescription>Quarter totals use the same envelope events as the monthly view.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Quarter</TableHead><TableHead className="text-right">Funded</TableHead><TableHead className="text-right">Released</TableHead><TableHead className="text-right">Spent</TableHead><TableHead className="text-right">Ending available</TableHead></TableRow></TableHeader>
            <TableBody>{quarterly.map((quarter) => <TableRow key={quarter.label}><TableCell className="font-medium">{quarter.label}</TableCell><TableCell className="text-right tabular-nums">{currency.format(quarter.funded)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(quarter.released)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(quarter.spent)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(quarter.endingAvailable)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> Monthly movement</CardTitle><CardDescription>Funding and release movement are shown separately from spending.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Funded</TableHead><TableHead className="text-right">Released</TableHead><TableHead className="text-right">Spent</TableHead><TableHead className="text-right">Ending available</TableHead></TableRow></TableHeader>
            <TableBody>{monthly.map((month) => <TableRow key={month.label}><TableCell className="font-medium">{month.label}</TableCell><TableCell className="text-right tabular-nums">{currency.format(month.funded)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(month.released)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(month.spent)}</TableCell><TableCell className="text-right tabular-nums">{currency.format(month.endingAvailable)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
