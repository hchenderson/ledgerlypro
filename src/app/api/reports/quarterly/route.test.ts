import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/requireUid', async () => {
  const { AuthenticationError } = await import('@/lib/auth-token');
  return {
    AuthenticationError,
    requireUid: vi.fn(),
  };
});
vi.mock('@/lib/quarterly-reports-server', () => ({
  deleteQuarterlyReport: vi.fn(),
  generateQuarterlyReport: vi.fn(),
}));
vi.mock('@/lib/server-logger', () => ({
  logServerEvent: vi.fn(),
  requestLogContext: vi.fn(() => ({ operation: 'test', requestId: 'request-123' })),
}));

import { POST } from './route';
import { AuthenticationError, requireUid } from '@/lib/requireUid';
import { generateQuarterlyReport } from '@/lib/quarterly-reports-server';

describe('quarterly report API security', () => {
  beforeEach(() => vi.clearAllMocks());

  it('derives report ownership from the verified token, never a submitted user ID', async () => {
    vi.mocked(requireUid).mockResolvedValue('verified-user');
    vi.mocked(generateQuarterlyReport).mockResolvedValue({
      period: 'Q3 2026',
    } as Awaited<ReturnType<typeof generateQuarterlyReport>>);

    const response = await POST(new Request('https://example.test/api/reports/quarterly', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: 'attacker-selected-user',
        reportYear: 2026,
        quarter: 3,
        startDate: '2026-07-01T04:00:00.000Z',
        endDate: '2026-10-01T03:59:59.999Z',
      }),
    }));

    expect(response.status).toBe(200);
    expect(generateQuarterlyReport).toHaveBeenCalledWith(expect.objectContaining({
      uid: 'verified-user',
      reportYear: 2026,
      quarter: 3,
      startDate: new Date('2026-07-01T04:00:00.000Z'),
      endDate: new Date('2026-10-01T03:59:59.999Z'),
    }));
    expect(generateQuarterlyReport).not.toHaveBeenCalledWith(expect.objectContaining({
      uid: 'attacker-selected-user',
    }));
    expect(response.headers.get('x-request-id')).toBe('request-123');
  });

  it('rejects unauthenticated report generation', async () => {
    vi.mocked(requireUid).mockRejectedValue(new AuthenticationError('Missing token'));

    const response = await POST(new Request('https://example.test/api/reports/quarterly', {
      method: 'POST',
      body: JSON.stringify({ referenceDate: '2026-07-14T12:00:00.000Z' }),
    }));

    expect(response.status).toBe(401);
    expect(generateQuarterlyReport).not.toHaveBeenCalled();
  });
});
