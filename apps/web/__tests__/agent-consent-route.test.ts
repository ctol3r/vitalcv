/**
 * POST/GET /api/agent/consent — auth, server-derived subject, scope
 * validation, and the strict-write contract (a consent that does not
 * persist reports failure rather than implying an authorization exists).
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
const grantMock = vi.hoisted(() => vi.fn());
const revokeMock = vi.hoisted(() => vi.fn());
const readMock = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/agent/consent/consent-store', () => ({
  grantAgentConsent: grantMock,
  revokeAgentConsent: revokeMock,
  readAgentConsentStates: readMock,
}));

async function loadRoute() {
  return import(new URL('../app/api/agent/consent/route.ts', import.meta.url).href);
}

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/agent/consent', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetModules();
  authMock.mockReset();
  grantMock.mockReset();
  revokeMock.mockReset();
  readMock.mockReset();
  authMock.mockResolvedValue({ userId: 'user_consent_1' });
  grantMock.mockResolvedValue({ persisted: true, eventId: 'evt-1', changed: true });
  revokeMock.mockResolvedValue({ persisted: true, eventId: 'evt-2', changed: true });
  readMock.mockResolvedValue([{ scope: 'share_packet:opportunity:opp-42', granted: true, eventRef: 'evt-1', at: '2026-08-07T00:00:00.000Z' }]);
});

describe('POST /api/agent/consent', () => {
  it('requires a session', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { POST } = await loadRoute();
    expect((await POST(post({ decision: 'grant', scope: 'share_packet:opportunity:x' }))).status).toBe(401);
  });

  it('refuses a client-supplied subject or proof', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post({ decision: 'grant', scope: 'share_packet:opportunity:x', subjectRef: 'someone_else', consentProof: {} }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.rejectedFields).toEqual(expect.arrayContaining(['subjectRef', 'consentProof']));
    expect(grantMock).not.toHaveBeenCalled();
  });

  it('validates the decision and the scope grammar', async () => {
    const { POST } = await loadRoute();
    expect((await POST(post({ decision: 'maybe', scope: 'share_packet:opportunity:x' }))).status).toBe(400);
    expect((await POST(post({ decision: 'grant', scope: 'no-colon' }))).status).toBe(400);
    expect((await POST(post({ decision: 'grant', scope: `share_packet:${'x'.repeat(200)}` }))).status).toBe(400);
    expect(grantMock).not.toHaveBeenCalled();
  });

  it('records a grant for the session subject only', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'grant', scope: 'share_packet:opportunity:opp-42', planId: 'plan_x' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ granted: true, changed: true, eventRef: 'evt-1' });
    expect(grantMock).toHaveBeenCalledWith(
      expect.objectContaining({ subjectRef: 'user_consent_1', scope: 'share_packet:opportunity:opp-42', planId: 'plan_x' }),
    );
  });

  it('records a revocation', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'revoke', scope: 'share_packet:opportunity:opp-42' }));
    expect(response.status).toBe(200);
    expect((await response.json()).granted).toBe(false);
    expect(revokeMock).toHaveBeenCalled();
  });

  it('reports 503 when the ledger write does not persist — never a phantom grant', async () => {
    grantMock.mockResolvedValue({ persisted: false, eventId: null, changed: false });
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'grant', scope: 'share_packet:opportunity:opp-42' }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain('could not be recorded');
  });
});

describe('GET /api/agent/consent', () => {
  it('returns the fold for the session subject', async () => {
    const { GET } = await loadRoute();
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).consents[0].scope).toBe('share_packet:opportunity:opp-42');
    expect(readMock).toHaveBeenCalledWith('user_consent_1');
  });
});
