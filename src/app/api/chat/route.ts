import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getFinancialAssistantReply } from '@/ai/flows/financial-assistant';
import { adminCredentialIssue, adminDb } from '@/lib/firebaseAdmin';
import { buildFinancialAssistantContext } from '@/lib/financial-assistant-context';
import { AuthenticationError, requireUid } from '@/lib/requireUid';
import { logServerEvent, requestLogContext } from '@/lib/server-logger';
import { checkDistributedRateLimit } from '@/lib/distributed-rate-limit';
import type { Budget, Category, Goal, RecurringTransaction, Transaction } from '@/types';

const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(1_000),
  })).min(1).max(20),
});

function snapshotData<T extends { id: string }>(snapshot: FirebaseFirestore.QuerySnapshot): T[] {
  return snapshot.docs.map((document) => ({
    ...document.data(),
    id: document.id,
  })) as T[];
}

export async function POST(req: Request) {
  const logContext = requestLogContext(req, 'chat.reply');
  try {
    const uid = await requireUid(req);
    if (!adminDb) throw new Error('Firebase Admin SDK is not initialized.');
    if (adminCredentialIssue) {
      logServerEvent('error', 'chat.reply.admin_credentials_invalid', { ...logContext, uid });
      return NextResponse.json(
        {
          error: 'The local AI service needs a valid Firebase Admin credential file. See the Local setup section in README.md.',
        },
        { status: 503, headers: { 'x-request-id': logContext.requestId } }
      );
    }
    const rateLimit = await checkDistributedRateLimit({ key: `chat:${uid}`, limit: 20, windowMs: 60_000 });
    if (!rateLimit.allowed) {
      logServerEvent('warn', 'chat.reply.rate_limited', { ...logContext, uid });
      return NextResponse.json(
        { error: 'Too many chat requests. Please wait a moment and try again.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
            'x-request-id': logContext.requestId,
          },
        }
      );
    }

    const parsed = ChatRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      logServerEvent('warn', 'chat.reply.invalid_request', { ...logContext, uid });
      return NextResponse.json(
        { error: 'Send between 1 and 20 messages, with each message under 1,000 characters.' },
        { status: 400, headers: { 'x-request-id': logContext.requestId } }
      );
    }

    const lastUserMessage = [...parsed.data.messages]
      .reverse()
      .find((message) => message.role === 'user');
    if (!lastUserMessage) {
      return NextResponse.json(
        { error: 'A user question is required.' },
        { status: 400, headers: { 'x-request-id': logContext.requestId } }
      );
    }

    const userRef = adminDb.collection('users').doc(uid);
    const [transactionsSnapshot, categoriesSnapshot, budgetsSnapshot, goalsSnapshot, recurringSnapshot] = await Promise.all([
      userRef.collection('transactions').orderBy('date', 'desc').get(),
      userRef.collection('categories').get(),
      userRef.collection('budgets').get(),
      userRef.collection('goals').get(),
      userRef.collection('recurringTransactions').get(),
    ]);

    const context = buildFinancialAssistantContext({
      transactions: snapshotData<Transaction>(transactionsSnapshot),
      categories: snapshotData<Category>(categoriesSnapshot),
      budgets: snapshotData<Budget>(budgetsSnapshot),
      goals: snapshotData<Goal>(goalsSnapshot),
      recurringTransactions: snapshotData<RecurringTransaction>(recurringSnapshot),
      question: lastUserMessage.content,
    });
    const conversation = parsed.data.messages
      .slice(0, -1)
      .slice(-8);
    const result = await getFinancialAssistantReply({
      question: lastUserMessage.content,
      conversation,
      context,
    });

    logServerEvent('info', 'chat.reply.completed', {
      ...logContext,
      uid,
      transactionCount: context.summary.transactionCount,
    });
    return NextResponse.json(result, {
      headers: { 'x-request-id': logContext.requestId },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      logServerEvent('warn', 'chat.reply.unauthorized', logContext, error);
      return NextResponse.json(
        { error: error.message },
        { status: 401, headers: { 'x-request-id': logContext.requestId } }
      );
    }
    logServerEvent('error', 'chat.reply.failed', logContext, error);
    return NextResponse.json(
      { error: 'The assistant is temporarily unavailable. Please try again.' },
      { status: 500, headers: { 'x-request-id': logContext.requestId } }
    );
  }
}
