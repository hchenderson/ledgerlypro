"use client";

import React, { useMemo } from "react";
import { addDays, parseISO, format, startOfDay } from "date-fns";
import type { ForecastTx } from "@/forecast/expandRecurringBetween";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type Row = {
  dateKey: string; // YYYY-MM-DD
  dateLabel: string;
  expenseTotal: number;
  incomeTotal: number;
  items: ForecastTx[];
};

export function RecurringCommitmentsList({
  recurringFuture,
}: {
  recurringFuture: ForecastTx[];
}) {
  const rows = useMemo(() => {
    const start = startOfDay(new Date());
    const end = addDays(start, 30);
    const startKey = start.toISOString().slice(0, 10);
    const endKey = end.toISOString().slice(0, 10);

    const inRange = recurringFuture.filter((t) => {
      const k = t.date.slice(0, 10);
      return k >= startKey && k <= endKey;
    });

    const map = new Map<string, Row>();

    for (const t of inRange) {
      const dateKey = t.date.slice(0, 10);
      const dateLabel = format(parseISO(t.date), "EEE, MMM d");
      const prev =
        map.get(dateKey) ??
        { dateKey, dateLabel, expenseTotal: 0, incomeTotal: 0, items: [] };

      if (t.type === "expense") prev.expenseTotal += t.amount;
      else prev.incomeTotal += t.amount;

      prev.items.push(t);
      map.set(dateKey, prev);
    }

    return Array.from(map.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [recurringFuture]);

  if (!rows.length) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">
        No recurring commitments detected in the next 30 days.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      {rows.slice(0, 10).map((r) => (
        <div key={r.dateKey} className="min-w-0 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="font-medium">{r.dateLabel}</div>
            <div className="max-w-full text-sm tabular-nums text-muted-foreground">
              {r.incomeTotal ? `+${currency.format(r.incomeTotal)} ` : ""}
              {r.expenseTotal ? `-${currency.format(r.expenseTotal)}` : ""}
            </div>
          </div>

          <div className="mt-2 space-y-1 text-sm">
            {r.items.slice(0, 4).map((t) => (
              <div key={t.id} className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 truncate" title={`${t.description ?? "Recurring item"}${t.category ? ` • ${t.category}` : ""}`}>
                  {t.description ?? "Recurring item"}
                  {t.category ? <span className="text-muted-foreground"> • {t.category}</span> : null}
                </div>
                <div className="max-w-[45%] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap tabular-nums" title={`${t.type === "income" ? "+" : "-"}${currency.format(t.amount)}`}>
                  {t.type === "income" ? "+" : "-"}
                  {currency.format(t.amount)}
                </div>
              </div>
            ))}
            {r.items.length > 4 ? (
              <div className="text-muted-foreground">+{r.items.length - 4} more…</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
