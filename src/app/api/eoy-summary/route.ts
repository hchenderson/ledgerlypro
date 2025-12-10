// /app/api/eoy-summary/route.ts
import { NextResponse } from "next/server";

/**
 * Body expected:
 * {
 *   year: number;
 *   totalIncome: number;
 *   totalExpenses: number;
 *   net: number;
 *   topCategories: { name: string; total: number; percentageOfTotal: number }[];
 * }
 */

export async function POST(req: Request) {
  const body = await req.json();

  const {
    year,
    totalIncome,
    totalExpenses,
    net,
    topCategories = [],
  } = body;

  const topThree = topCategories.slice(0, 3);
  const topDescriptions = topThree
    .map(
      (c) =>
        `${c.name} at $${c.total.toFixed(2)} (${c.percentageOfTotal.toFixed(
          1
        )}% of expenses)`
    )
    .join("; ");

  const direction =
    net > 0
      ? "ended the year with a surplus"
      : net < 0
      ? "closed the year with a shortfall"
      : "finished roughly at break-even";

  const tone =
    net > 0
      ? "Overall, this reflects prudent stewardship and a generally healthy financial posture."
      : net < 0
      ? "Overall, this suggests a season of elevated spending or constrained income that may warrant recalibration in the coming year."
      : "Overall, this indicates a balanced year, though there may still be room to refine certain spending patterns.";

  const summary = `
During ${year}, total recorded income amounted to $${totalIncome.toFixed(
    2
  )}, while total expenses reached $${totalExpenses.toFixed(
    2
  )}. You ${direction} of $${Math.abs(net).toFixed(2)}.

The primary spending concentrations were in the following areas: ${topDescriptions ||
    "no dominant categories emerged from the data"}. These categories shaped much of the financial story for the year.

${tone}
Looking ahead, consider whether your current allocations still match your priorities. Small adjustments, made intentionally, can compound into substantial progress over the next twelve months.
  `.trim();

  return NextResponse.json({ summary });
}
