import { NextResponse } from 'next/server';
import { z } from 'zod';

import { AuthenticationError, requireUid } from '@/lib/requireUid';
import { checkDistributedRateLimit } from '@/lib/distributed-rate-limit';
import { logServerEvent, requestLogContext } from '@/lib/server-logger';

const EoySummarySchema = z.object({
  year: z.number().int().min(1900).max(2200),
  totalIncome: z.number().finite().nonnegative(),
  totalExpenses: z.number().finite().nonnegative(),
  net: z.number().finite(),
  topCategories: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    total: z.number().finite().nonnegative(),
    percentageOfTotal: z.number().finite().min(0).max(100),
  })).max(100).default([]),
});

export async function POST(req: Request) {
  const context = requestLogContext(req, 'eoy-summary.generate');
  try {
    const uid = await requireUid(req);
    const rateLimit = await checkDistributedRateLimit({ key: `eoy-summary:${uid}`, limit: 30, windowMs: 60_000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many summary requests. Please wait and try again.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
            'x-request-id': context.requestId,
          },
        }
      );
    }

    const parsed = EoySummarySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      logServerEvent('warn', 'eoy-summary.invalid_request', { ...context, uid });
      return NextResponse.json(
        { error: 'Invalid year-end summary data.' },
        { status: 400, headers: { 'x-request-id': context.requestId } }
      );
    }

    const { year, totalIncome, totalExpenses, net, topCategories } = parsed.data;
    const topDescriptions = topCategories
      .slice(0, 3)
      .map((category) =>
        `${category.name} at $${category.total.toFixed(2)} (${category.percentageOfTotal.toFixed(1)}% of expenses)`
      )
      .join('; ');
    const direction = net > 0
      ? 'ended the year with a surplus'
      : net < 0
        ? 'closed the year with a shortfall'
        : 'finished roughly at break-even';
    const tone = net > 0
      ? 'Overall, this reflects a generally healthy financial position.'
      : net < 0
        ? 'Overall, this may warrant reviewing elevated spending or constrained income in the coming year.'
        : 'Overall, this indicates a balanced year, with room to refine individual spending areas.';
    const summary = `During ${year}, total recorded income was $${totalIncome.toFixed(2)}, while total expenses were $${totalExpenses.toFixed(2)}. You ${direction} of $${Math.abs(net).toFixed(2)}.\n\nThe primary spending concentrations were ${topDescriptions || 'not identifiable from the recorded data'}.\n\n${tone} Consider whether your current allocations still match your priorities.`;

    logServerEvent('info', 'eoy-summary.completed', { ...context, uid, year });
    return NextResponse.json({ summary }, {
      headers: { 'x-request-id': context.requestId },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      logServerEvent('warn', 'eoy-summary.unauthorized', context, error);
      return NextResponse.json(
        { error: error.message },
        { status: 401, headers: { 'x-request-id': context.requestId } }
      );
    }
    logServerEvent('error', 'eoy-summary.failed', context, error);
    return NextResponse.json(
      { error: 'Unable to generate a year-end summary.' },
      { status: 500, headers: { 'x-request-id': context.requestId } }
    );
  }
}
