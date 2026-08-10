/**
 * L3 — the apply route's outcome-join wiring.
 *
 * Separate file from the recorder suite on purpose (same reason as
 * agent-tick-route.test.ts): this file MOCKS the recorder to test the route,
 * so it must not share a file with direct tests of the recorder.
 *
 * What must hold:
 *   - a successful apply emits exactly one outcome, keyed to the session user;
 *   - a failed apply emits nothing (no outcome for an application that
 *     did not happen);
 *   - a recorder failure never changes the route's response — the hiring
 *     action succeeds or fails on its own merits.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));

vi.mock('@/lib/server/marketplace-proxy', () => ({
  MARKETPLACE_BACKEND: 'http://backend.test',
  buildMarketplaceHeaders: vi.fn(async () => ({ 'Content-Type': 'application/json' })),
}));

vi.mock('@/lib/server/pilot-ops', () => ({
  getPilotSurfaceControl: vi.fn(async () => null),
  recordPilotServerEvent: vi.fn(async () => undefined),
}));

const recordOutcomeMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/agent/outcomes/record-outcome', () => ({
  recordHiringOutcome: recordOutcomeMock,
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

async function callApply() {
  const { POST } = await import('../app/api/opportunities/[id]/apply/route');
  const req = new NextRequest('http://localhost/api/opportunities/opp-1/apply', {
    method: 'POST',
    body: JSON.stringify({ note: 'hi' }),
  });
  return POST(req, { params: Promise.resolve({ id: 'opp-1' }) });
}

beforeEach(() => {
  vi.resetModules();
  authMock.mockResolvedValue({ userId: 'user_clin_1' });
  recordOutcomeMock.mockReset();
  recordOutcomeMock.mockResolvedValue({ recorded: true });
  fetchMock.mockReset();
});

describe('POST /api/opportunities/[id]/apply — outcome join', () => {
  it('emits one application outcome for the session user on success', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ applicationId: 'app-42' }), { status: 200 }),
    );

    const res = await callApply();

    expect(res.status).toBe(200);
    expect(recordOutcomeMock).toHaveBeenCalledTimes(1);
    expect(recordOutcomeMock).toHaveBeenCalledWith({
      kind: 'application',
      ref: 'app-42',
      subjectRef: 'user_clin_1',
      metadata: { opportunityId: 'opp-1', route: 'apply' },
    });
  });

  it('falls back to the opportunity id when the backend returns no application id', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    await callApply();

    expect(recordOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'opp-1' }),
    );
  });

  it('emits nothing when the backend rejects the application', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'closed' }), { status: 409 }),
    );

    const res = await callApply();

    expect(res.status).toBe(409);
    expect(recordOutcomeMock).not.toHaveBeenCalled();
  });

  it('returns the backend payload unchanged when the recorder fails', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ applicationId: 'app-42' }), { status: 200 }),
    );
    recordOutcomeMock.mockResolvedValue({ recorded: false, reason: 'error' });

    const res = await callApply();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applicationId: 'app-42' });
  });
});
