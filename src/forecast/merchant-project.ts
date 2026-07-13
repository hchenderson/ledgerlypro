import { startOfDay } from "date-fns";
import type { ForecastTx } from "./expandRecurringBetween";
import type { MerchantProfile } from "./merchant-profile";

type Weekday = 0|1|2|3|4|5|6;

export function projectMerchantBaseline(
  profile: MerchantProfile,
  start: Date,
  end: Date
): ForecastTx[] {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);

  const out: ForecastTx[] = [];
  const merchants = Object.entries(profile.merchants);

  for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
    const iso = new Date(d).toISOString();
    const wd = new Date(d).getDay() as Weekday;

    for (const [merchantKey, m] of merchants) {
      // Expense
      if (m.expense) {
        const amt = m.expense.weeklyAvg * (m.expense.weekdayWeights[wd] ?? (1/7));
        if (amt > 0) {
          out.push({
            id: `mb_exp_${merchantKey}_${iso}`,
            date: iso,
            amount: amt,
            type: "expense",
            category: m.category,
            description: `(Baseline) ${m.merchantName}`,
            source: "baseline",
          });
        }
      }
      // Income (less common merchant-stable, but possible)
      if (m.income) {
        const amt = m.income.weeklyAvg * (m.income.weekdayWeights[wd] ?? (1/7));
        if (amt > 0) {
          out.push({
            id: `mb_inc_${merchantKey}_${iso}`,
            date: iso,
            amount: amt,
            type: "income",
            category: m.category,
            description: `(Baseline) ${m.merchantName}`,
            source: "baseline",
          });
        }
      }
    }
  }

  return out;
}
