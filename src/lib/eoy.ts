
// /lib/eoy.ts
import {
  startOfYear,
  endOfYear,
  parseISO,
  getMonth,
  format,
} from "date-fns";
import type { Transaction, Category, SubCategory } from "@/types";

export interface EOYMonthlyPoint {
  monthIndex: number;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

export interface EOYCategorySummary {
  name: string;
  total: number;
  percentageOfTotal: number;
}

export interface EOYReportData {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  net: number;
  monthly: EOYMonthlyPoint[];
  categories: EOYCategorySummary[];
  mainCategories: EOYCategorySummary[];
}

function findMainCategoryForSub(
  subCategoryName: string,
  categories: Category[]
): Category | undefined {
  for (const mainCat of categories) {
    if (mainCat.name === subCategoryName) return mainCat;
    
    const findInSubs = (subs: SubCategory[]): boolean => {
      for (const sub of subs) {
        if (sub.name === subCategoryName) return true;
        if (sub.subCategories && findInSubs(sub.subCategories)) return true;
      }
      return false;
    }

    if (mainCat.subCategories && findInSubs(mainCat.subCategories)) {
      return mainCat;
    }
  }
  return undefined;
}


function flattenCategoryNames(cats: Category[]): string[] {
  let list: string[] = [];
  cats.forEach((c) => {
    list.push(c.name);
    if ((c as any).subCategories) {
      list = list.concat(flattenCategoryNames((c as any).subCategories));
    }
  });
  return list;
}

export function computeEOYReport(
  allTransactions: Transaction[],
  categories: Category[],
  year: number
): EOYReportData {
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(new Date(year, 11, 31));

  const yearTx = allTransactions.filter((tx) => {
    const d = parseISO(tx.date);
    return d >= start && d <= end;
  });

  const monthly: EOYMonthlyPoint[] = Array.from({ length: 12 }, (_, i) => ({
    monthIndex: i,
    label: format(new Date(year, i, 1), "MMM"),
    income: 0,
    expenses: 0,
    net: 0,
  }));

  const allCategoryNames = flattenCategoryNames(categories);
  const categoryTotals: Record<string, number> = {};
  allCategoryNames.forEach((name) => {
    categoryTotals[name] = 0;
  });

  const mainCategoryTotals: Record<string, number> = {};

  yearTx.forEach((tx) => {
    const m = getMonth(parseISO(tx.date));
    if (tx.type === "income") {
      monthly[m].income += tx.amount;
    } else if (tx.type === "expense") {
      monthly[m].expenses += tx.amount;
      if (categoryTotals[tx.category] !== undefined) {
        categoryTotals[tx.category] += tx.amount;
      }
      
      const mainCat = findMainCategoryForSub(tx.category, categories);
      if (mainCat) {
        mainCategoryTotals[mainCat.name] = (mainCategoryTotals[mainCat.name] || 0) + tx.amount;
      } else {
        mainCategoryTotals['Uncategorized'] = (mainCategoryTotals['Uncategorized'] || 0) + tx.amount;
      }
    }
  });

  monthly.forEach((m) => {
    m.net = m.income - m.expenses;
  });

  const totalIncome = monthly.reduce((sum, m) => sum + m.income, 0);
  const totalExpenses = monthly.reduce((sum, m) => sum + m.expenses, 0);
  const net = totalIncome - totalExpenses;

  const categoriesSummaries: EOYCategorySummary[] = [];
  const grandTotalExpenses = Object.values(categoryTotals).reduce(
    (a, b) => a + b,
    0
  );

  Object.entries(categoryTotals)
    .filter(([, total]) => total > 0)
    .forEach(([name, total]) => {
      const percentageOfTotal =
        grandTotalExpenses > 0 ? (total / grandTotalExpenses) * 100 : 0;
      categoriesSummaries.push({
        name,
        total,
        percentageOfTotal,
      });
    });

  categoriesSummaries.sort((a, b) => b.total - a.total);
  
  const mainCategoriesSummaries: EOYCategorySummary[] = [];
   Object.entries(mainCategoryTotals)
    .filter(([, total]) => total > 0)
    .forEach(([name, total]) => {
        const percentageOfTotal = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;
        mainCategoriesSummaries.push({
            name,
            total,
            percentageOfTotal,
        });
    });
  mainCategoriesSummaries.sort((a, b) => b.total - a.total);

  return {
    year,
    totalIncome,
    totalExpenses,
    net,
    monthly,
    categories: categoriesSummaries,
    mainCategories: mainCategoriesSummaries,
  };
}
