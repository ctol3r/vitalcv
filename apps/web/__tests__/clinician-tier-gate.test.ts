/**
 * Clinician-tier gate on the AI routes — the "clinicians only" enforcement.
 * Contract: below work_email_confirmed (or unreadable identity state) the
 * routes 403 with honest copy BEFORE any model call; the gate composes after
 * auth and rate-limiting.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));
vi.mock('@/lib/auth/forwardIdentity', () => ({
  buildIdentityHeaders: async () => ({ 'x-clerk-user-id': 'user_test' }),
}));

import { CLINICIAN_TIER_MESSAGE, userMeetsTier } from '@/lib/auth/clinicianTier';
import { POST as coverLetterPOST } from '@/app/api/matcha/cover-letter/route';

function identityFetchMock(tier: string | null, status = 200) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/profile/identity')) {
      if (tier === null) return new Response('{}', { status: 503 });
      return new Response(JSON.stringify({ tier, signals: {} }), { status });
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  }) as unknown as typeof fetch;
}

describe('userMeetsTier', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('true at or above the minimum tier', async () => {
    global.fetch = identityFetchMock('work_email_confirmed');
    expect(await userMeetsTier('user_test', 'work_email_confirmed')).toBe(true);
  });

  it('false below the minimum tier', async () => {
    global.fetch = identityFetchMock('npi_bound');
    expect(await userMeetsTier('user_test', 'work_email_confirmed')).toBe(false);
  });

  it('false at preview tier — a no-NPI preview never unlocks a clinician power', async () => {
    global.fetch = identityFetchMock('preview');
    expect(await userMeetsTier('user_test', 'work_email_confirmed')).toBe(false);
    global.fetch = identityFetchMock('preview');
    expect(await userMeetsTier('user_test', 'npi_bound')).toBe(false);
  });

  it('fails closed when the identity state is unreadable', async () => {
    global.fetch = identityFetchMock(null);
    expect(await userMeetsTier('user_test', 'work_email_confirmed')).toBe(false);
  });
});

describe('POST /api/matcha/cover-letter — tier gate', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key-not-used';
  });

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('403s below tier with the honest message, before any model call', async () => {
    authMock.mockResolvedValue({ userId: 'user_test' });
    const fetchSpy = identityFetchMock('npi_bound');
    global.fetch = fetchSpy;

    const req = new Request('http://localhost/api/matcha/cover-letter', {
      method: 'POST',
      body: JSON.stringify({ opportunity: { title: 'Role' }, profileSummary: 'x' }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await coverLetterPOST(req as any);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe(CLINICIAN_TIER_MESSAGE);
    // Only the identity lookup was fetched — never the Anthropic API.
    const urls = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(urls.every((u) => u.includes('/api/profile/identity'))).toBe(true);
  });

  it('401s signed-out before the tier check', async () => {
    authMock.mockResolvedValue({ userId: null });
    const fetchSpy = identityFetchMock('work_email_confirmed');
    global.fetch = fetchSpy;

    const req = new Request('http://localhost/api/matcha/cover-letter', {
      method: 'POST',
      body: '{}',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await coverLetterPOST(req as any);
    expect(res.status).toBe(401);
    expect((fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
