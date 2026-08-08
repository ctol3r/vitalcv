/**
 * Enforce-flip prerequisite for the unattended Start Agent path.
 *
 * A `system_scheduler` run has no Clerk session. It used to forward
 * `x-clerk-user-id` with `token: null` on the theory that identity-bound
 * routes would refuse it at the boundary. They did not: with the backend in
 * `CLERK_JWT_VERIFICATION=shadow` an unpaired identity header is *accepted*,
 * so a background tick read as the subject on a header nobody verified — and
 * under `enforce` the same request is a hard 401.
 *
 * Measured in production 2026-08-08: four `identity_header_without_bearer`
 * warnings from `buildIdentityHeaders`, corroborated by four backend
 * `header_without_token` events on `/api/trust-state/:npi` and
 * `/api/matcha/opportunities/:npi` — both NPI-keyed public routes that never
 * needed identity at all.
 *
 * These assert the headers that actually leave the process, via a captured
 * fetch — not the internals that build them.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));
vi.mock('@/lib/clinician-record/nppes', () => ({ fetchNppesRecord: async () => null }));
vi.mock('@/lib/agent/consent/consent-store', () => ({ readAgentConsentStates: async () => [] }));
vi.mock('@/lib/agent/telemetry/agent-run-store', () => ({ readAgentActionHistory: async () => [] }));

import { buildProductionReaders } from '@/lib/agent/server-readers';

const captured: Array<{ url: string; headers: Headers }> = [];

beforeEach(() => {
  authMock.mockReset();
  // A background tick has no request context; any auth() call is itself a bug.
  authMock.mockImplementation(() => {
    throw new Error('auth() must not be called on the scheduler path');
  });
  captured.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    captured.push({ url: String(url), headers: new Headers(init?.headers as HeadersInit) });
    return new Response(JSON.stringify({}), { status: 200 });
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('scheduler reads are anonymous — enforce readiness', () => {
  it('sends NO identity header on the trust-state read', async () => {
    const readers = buildProductionReaders('user_subject', { actor: 'system_scheduler' });
    await readers.readSourceCoverage('1013395227').catch(() => undefined);

    expect(captured).toHaveLength(1);
    // The assertion that fails without the fix.
    expect(captured[0].headers.get('x-clerk-user-id')).toBeNull();
    expect(captured[0].headers.get('authorization')).toBeNull();
    expect(captured[0].url).toContain('/api/trust-state/1013395227');
  });

  it('sends NO identity header on the opportunities read', async () => {
    const readers = buildProductionReaders('user_subject', { actor: 'system_scheduler' });
    await readers.readOpportunities('1013395227').catch(() => undefined);

    expect(captured).toHaveLength(1);
    expect(captured[0].headers.get('x-clerk-user-id')).toBeNull();
    expect(captured[0].headers.get('authorization')).toBeNull();
  });

  it('never emits an unpaired identity header — the exact enforce hazard', async () => {
    const readers = buildProductionReaders('user_subject', { actor: 'system_scheduler' });
    await readers.readSourceCoverage('1013395227').catch(() => undefined);
    await readers.readOpportunities('1346053246').catch(() => undefined);

    for (const req of captured) {
      const hasIdentity = req.headers.get('x-clerk-user-id') !== null;
      const hasBearer = req.headers.get('authorization') !== null;
      // Unpaired identity == 401 under CLERK_JWT_VERIFICATION=enforce.
      expect(hasIdentity && !hasBearer).toBe(false);
    }
  });

  it('does not warn, because it no longer forwards an unpaired header', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const readers = buildProductionReaders('user_subject', { actor: 'system_scheduler' });
    await readers.readSourceCoverage('1013395227').catch(() => undefined);

    const warned = warn.mock.calls.some((c) => String(c[0]).includes('identity_header_without_bearer'));
    expect(warned).toBe(false);
    warn.mockRestore();
  });

  it('a clinician session still forwards its identity pair', async () => {
    // Non-scheduler callers are unchanged: userId is left undefined so the
    // helper resolves it (and a bearer) from the live Clerk session.
    authMock.mockReturnValue({ userId: 'user_live', getToken: async () => 'jwt-live' });

    const readers = buildProductionReaders('user_live');
    await readers.readSourceCoverage('1013395227').catch(() => undefined);

    expect(captured[0].headers.get('x-clerk-user-id')).toBe('user_live');
    expect(captured[0].headers.get('authorization')).toBe('Bearer jwt-live');
  });
});
