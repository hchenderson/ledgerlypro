import { addWeeks, startOfDay, parseISO, isWithinInterval } from "date-fns";
import type { ForecastTx } from "./expandRecurringBetween";
import { normalizeMerchant } from "./merchant-normalize";

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a,b)=>a+b,0) / xs.length : 0);

const normalizeWeights = (w: Record<Weekday, number>) => {
  const sum = Object.values(w).reduce((a,b)=>a+b,0) || 1;
  const out = { ...w } as Record<Weekday, number>;
  (Object.keys(out) as unknown as Weekday[]).forEach(k => (out[k] = out[k] / sum));
  return out;
};

const emptyWeekday = (): Record<Weekday, number> => ({ 0:0,1:0,2:0,3:0,4:0,5:0,6:0 });

function weekKeyMonday(iso: string) {
  const d = parseISO(iso);
  const monday = new Date(d);
  const day = monday.getDay();
  const diff = (day + 6) % 7;
  monday.setDate(monday.getDate() - diff);
  monday.setHours(0,0,0,0);
  return monday.toISOString();
}

function isActualVariable(t: ForecastTx) {
  return t.source === "actual" && !((t.description || "").startsWith("(Recurring)"));
}

export type MerchantProfile = {
  merchants: Record<
    string,
    {
      merchantName: string;
      // dominant category association (most frequent category)
      category: string;
      income?: { weeklyAvg: number; weekdayWeights: Record<Weekday, number>; weeklySamples: number[] };
      expense?: { weeklyAvg: number; weekdayWeights: Record<Weekday, number>; weeklySamples: number[] };
    }
  >;
};

export function buildMerchantProfile(
  actuals: ForecastTx[],
  lookbackWeeks = 26,
  minWeeks = 4,
  opts?: { baselineExclusions?: { categories?: string[]; merchants?: string[] } }
): MerchantProfile {
  const today = startOfDay(new Date());
  const start = addWeeks(today, -lookbackWeeks);

  const excludeCats = new Set((opts?.baselineExclusions?.categories ?? []).map(s => s.trim()));
  const excludeMerchants = new Set((opts?.baselineExclusions?.merchants ?? []).map(s => s.trim()));

  // merchant -> week -> totals
  const byMerchantWeek = new Map<string, Map<string, { income: number; expense: number }>>();
  const byMerchantWeekday = new Map<string, { income: Record<Weekday, number>; expense: Record<Weekday, number> }>();
  const merchantCategoryCounts = new Map<string, Map<string, number>>();
  const merchantNameMap = new Map<string, string>();

  for (const t of actuals) {
    const d = parseISO(t.date);
    if (!isActualVariable(t)) continue;
    if (!isWithinInterval(d, { start, end: today })) continue;

    const cat = (t.category || "Uncategorized").trim() || "Uncategorized";
    if (excludeCats.has(cat)) continue;

    const { merchantName, merchantKey } = normalizeMerchant((t as any).merchantName ?? t.description);
    if (excludeMerchants.has(merchantKey)) continue;

    merchantNameMap.set(merchantKey, merchantName);

    // category association tally
    const cc = merchantCategoryCounts.get(merchantKey) ?? new Map<string, number>();
    cc.set(cat, (cc.get(cat) ?? 0) + 1);
    merchantCategoryCounts.set(merchantKey, cc);

    // weekly aggregation
    const wk = weekKeyMonday(t.date);
    const wm = byMerchantWeek.get(merchantKey) ?? new Map();
    const prev = wm.get(wk) ?? { income: 0, expense: 0 };
    if (t.type === "income") prev.income += t.amount;
    else prev.expense += t.amount;
    wm.set(wk, prev);
    byMerchantWeek.set(merchantKey, wm);

    // weekday aggregation
    const wd = d.getDay() as Weekday;
    const wds = byMerchantWeekday.get(merchantKey) ?? { income: emptyWeekday(), expense: emptyWeekday() };
    if (t.type === "income") wds.income[wd] += t.amount;
    else wds.expense[wd] += t.amount;
    byMerchantWeekday.set(merchantKey, wds);
  }

  const merchants: MerchantProfile["merchants"] = {};

  for (const [merchantKey, weekMap] of byMerchantWeek.entries()) {
    const weeks = Array.from(weekMap.values());
    const incomeSamples = weeks.map(w => w.income).filter(n => n !== 0);
    const expenseSamples = weeks.map(w => w.expense).filter(n => n !== 0);

    const categoryCounts = merchantCategoryCounts.get(merchantKey) ?? new Map();
    const dominantCategory =
      Array.from(categoryCounts.entries()).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "Uncategorized";

    const name = merchantNameMap.get(merchantKey) ?? merchantKey;
    const weekdaySums = byMerchantWeekday.get(merchantKey) ?? { income: emptyWeekday(), expense: emptyWeekday() };

    const entry: any = { merchantName: name, category: dominantCategory };

    if (incomeSamples.length >= minWeeks) {
      entry.income = {
        weeklyAvg: avg(incomeSamples),
        weekdayWeights: normalizeWeights(weekdaySums.income),
        weeklySamples: incomeSamples,
      };
    }

    if (expenseSamples.length >= minWeeks) {
      entry.expense = {
        weeklyAvg: avg(expenseSamples),
        weekdayWeights: normalizeWeights(weekdaySums.expense),
        weeklySamples: expenseSamples,
      };
    }

    // Only include merchants that have enough signal in at least one direction
    if (entry.income || entry.expense) {
      merchants[merchantKey] = entry;
    }
  }

  return { merchants };
}
