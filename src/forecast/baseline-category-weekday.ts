import { addWeeks, startOfDay, parseISO, isWithinInterval } from "date-fns";
import type { ForecastTx } from "./expandRecurringBetween";

type TxType = "income" | "expense";

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // JS getDay(): Sun=0 ... Sat=6

export type CategoryWeekdayProfile = {
  // For each category and type, we store:
  // - avg weekly total
  // - weekday weights (sum to 1)
  // - optional sample distribution for later confidence bands
  categories: Record<
    string,
    {
      income?: {
        weeklyAvg: number;
        weekdayWeights: Record<Weekday, number>;
        weeklySamples: number[];
      };
      expense?: {
        weeklyAvg: number;
        weekdayWeights: Record<Weekday, number>;
        weeklySamples: number[];
      };
    }
  >;

  // fallback global pattern if a category is too sparse
  global: {
    income: { weeklyAvg: number; weekdayWeights: Record<Weekday, number>; weeklySamples: number[] };
    expense: { weeklyAvg: number; weekdayWeights: Record<Weekday, number>; weeklySamples: number[] };
  };
};

const emptyWeights = (): Record<Weekday, number> => ({
  0: 1 / 7,
  1: 1 / 7,
  2: 1 / 7,
  3: 1 / 7,
  4: 1 / 7,
  5: 1 / 7,
  6: 1 / 7,
});

const normalizeWeights = (w: Record<Weekday, number>) => {
  const sum = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const out = { ...w } as Record<Weekday, number>;
  (Object.keys(out) as unknown as Weekday[]).forEach((k) => (out[k] = out[k] / sum));
  return out;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function safeCategory(t: ForecastTx) {
  // For v1: use t.category string; later you can map vendor→category, etc.
  return (t.category || "Uncategorized").trim() || "Uncategorized";
}

function isActualVariable(t: ForecastTx) {
  // Your recurring materialization prefixes description with "(Recurring)"
  return t.source === "actual" && !((t.description || "").startsWith("(Recurring)"));
}

export function buildCategoryWeekdayProfile(
  actuals: ForecastTx[],
  lookbackWeeks = 13,
  minWeeksPerCategory = 4
): CategoryWeekdayProfile {
  const today = startOfDay(new Date());
  const start = addWeeks(today, -lookbackWeeks);

  const windowTx = actuals.filter((t) => {
    const d = parseISO(t.date);
    return isActualVariable(t) && isWithinInterval(d, { start, end: today });
  });

  // Bucket by (category, type, weekKey) and also weekday sums within each category+type.
  const weekKey = (iso: string) => {
    const d = parseISO(iso);
    const monday = new Date(d);
    const day = monday.getDay();
    const diff = (day + 6) % 7;
    monday.setDate(monday.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  };

  type WeekAgg = { income: number; expense: number };
  const globalByWeek = new Map<string, WeekAgg>();
  const globalWeekdaySum: Record<TxType, Record<Weekday, number>> = {
    income: { ...emptyWeights(), 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    expense: { ...emptyWeights(), 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  };

  const catByWeek = new Map<string, Map<string, WeekAgg>>(); // cat -> weekKey -> agg
  const catWeekdaySum = new Map<string, { income: Record<Weekday, number>; expense: Record<Weekday, number> }>();

  for (const t of windowTx) {
    const cat = safeCategory(t);
    const type = t.type as TxType;
    const wk = weekKey(t.date);
    const wd = parseISO(t.date).getDay() as Weekday;

    // global weekly
    const g = globalByWeek.get(wk) ?? { income: 0, expense: 0 };
    g[type] += t.amount;
    globalByWeek.set(wk, g);

    // global weekday sums
    globalWeekdaySum[type][wd] += t.amount;

    // category weekly
    const weekMap = catByWeek.get(cat) ?? new Map<string, WeekAgg>();
    const c = weekMap.get(wk) ?? { income: 0, expense: 0 };
    c[type] += t.amount;
    weekMap.set(wk, c);
    catByWeek.set(cat, weekMap);

    // category weekday sums
    const sums =
      catWeekdaySum.get(cat) ??
      {
        income: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        expense: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      };
    sums[type][wd] += t.amount;
    catWeekdaySum.set(cat, sums);
  }

  // Build global stats
  const globalIncomeSamples = Array.from(globalByWeek.values()).map((v) => v.income);
  const globalExpenseSamples = Array.from(globalByWeek.values()).map((v) => v.expense);

  const globalIncomeWeeklyAvg = avg(globalIncomeSamples);
  const globalExpenseWeeklyAvg = avg(globalExpenseSamples);

  const globalIncomeWeights = normalizeWeights(globalWeekdaySum.income);
  const globalExpenseWeights = normalizeWeights(globalWeekdaySum.expense);

  // Build per-category stats with sparsity fallback
  const categories: CategoryWeekdayProfile["categories"] = {};

  for (const [cat, weekMap] of catByWeek.entries()) {
    const weeks = Array.from(weekMap.values());
    const incomeSamples = weeks.map((v) => v.income).filter((n) => n !== 0);
    const expenseSamples = weeks.map((v) => v.expense).filter((n) => n !== 0);

    const sums = catWeekdaySum.get(cat);

    // Only keep category profiles that have enough weekly samples; otherwise fall back to global.
    if (incomeSamples.length >= minWeeksPerCategory) {
      categories[cat] = categories[cat] || {};
      categories[cat].income = {
        weeklyAvg: avg(incomeSamples),
        weekdayWeights: normalizeWeights(sums?.income ?? emptyWeights()),
        weeklySamples: incomeSamples,
      };
    }
    if (expenseSamples.length >= minWeeksPerCategory) {
      categories[cat] = categories[cat] || {};
      categories[cat].expense = {
        weeklyAvg: avg(expenseSamples),
        weekdayWeights: normalizeWeights(sums?.expense ?? emptyWeights()),
        weeklySamples: expenseSamples,
      };
    }
  }

  return {
    categories,
    global: {
      income: { weeklyAvg: globalIncomeWeeklyAvg, weekdayWeights: globalIncomeWeights, weeklySamples: globalIncomeSamples },
      expense: { weeklyAvg: globalExpenseWeeklyAvg, weekdayWeights: globalExpenseWeights, weeklySamples: globalExpenseSamples },
    },
  };
}

export function projectCategoryWeekdayBaseline(
  profile: CategoryWeekdayProfile,
  start: Date,
  end: Date,
  opts?: {
    includeCategories?: string[]; // restrict to subset
    labelPrefix?: string;
  }
): ForecastTx[] {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);

  const cats = opts?.includeCategories?.length
    ? opts.includeCategories
    : Object.keys(profile.categories);

  const out: ForecastTx[] = [];

  for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
    const iso = new Date(d).toISOString();
    const wd = new Date(d).getDay() as Weekday;

    // For each category, add expected income/expense for that weekday
    for (const cat of cats) {
      const catProf = profile.categories[cat];

      // Income
      const inc = catProf?.income ?? null;
      const incBase = inc?.weeklyAvg ?? profile.global.income.weeklyAvg;
      const incW = inc?.weekdayWeights ?? profile.global.income.weekdayWeights;
      const incAmt = incBase * (incW[wd] ?? (1 / 7));
      if (incAmt > 0) {
        out.push({
          id: `baseline_income_${cat}_${iso}`,
          date: iso,
          amount: incAmt,
          type: "income",
          category: cat,
          description: `${opts?.labelPrefix ?? "(Baseline)"} ${cat} income`,
          source: "baseline",
        });
      }

      // Expense
      const exp = catProf?.expense ?? null;
      const expBase = exp?.weeklyAvg ?? profile.global.expense.weeklyAvg;
      const expW = exp?.weekdayWeights ?? profile.global.expense.weekdayWeights;
      const expAmt = expBase * (expW[wd] ?? (1 / 7));
      if (expAmt > 0) {
        out.push({
          id: `baseline_expense_${cat}_${iso}`,
          date: iso,
          amount: expAmt,
          type: "expense",
          category: cat,
          description: `${opts?.labelPrefix ?? "(Baseline)"} ${cat} expense`,
          source: "baseline",
        });
      }
    }
  }

  return out;
}
