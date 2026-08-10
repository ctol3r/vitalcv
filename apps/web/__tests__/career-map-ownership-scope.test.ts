/**
 * `viewerOwnsNpi` — the SCOPE half of the /career-map gate.
 *
 * The middleware guard is a turnstile: it proves someone is signed in, not that
 * the NPI in the URL is theirs. Without this check, gating the route would have
 * converted an anonymous read of any clinician into an authenticated read of any
 * clinician — a smaller hole, not a closed one.
 *
 * Two properties are asserted, and they are the ones that actually bite:
 *
 *  1. `pending` does NOT authorize. A claim is not a verification. If a claimed
 *     -but-unverified row granted access, anyone could claim an arbitrary NPI
 *     via POST /api/ownership/claim and immediately read that clinician's map,
 *     which would make the gate ceremonial. The backend states this directly:
 *     `authorizesPrivateAccess` admits only `verified` and `delegated`.
 *  2. It fails CLOSED on every ambiguity. A surface that cannot confirm
 *     ownership must behave exactly as it does for a stranger, so a backend
 *     outage degrades to "not yours" rather than to "everyone's".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({ userId: 'user_1' as string | null }));

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: clerk.userId }),
}));

vi.mock('@/lib/auth/forwardIdentity', () => ({
  buildIdentityHeaders: async () => ({ 'x-vitalcv-user-id': 'user_1' }),
}));

const { viewerOwnsNpi } = await import('@/lib/auth/npi-ownership-scope');

const OWNED = '1003000126';
const OTHER = '1234567893';

/** Stub the backend `/api/ownership/me` response. */
function backendReturns(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      status,
      json: async () => body,
    })),
  );
}

beforeEach(() => {
  clerk.userId = 'user_1';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('states that authorize private access', () => {
  it.each(['verified', 'delegated'])('admits a %s ownership of the NPI', async (state) => {
    backendReturns({ ownerships: [{ npi: OWNED, state }] });

    await expect(viewerOwnsNpi(OWNED)).resolves.toBe(true);
  });
});

describe('states that do NOT authorize private access', () => {
  it.each(['pending', 'revoked', 'unknown', ''])(
    'refuses a %s ownership — a claim is not a verification',
    async (state) => {
      backendReturns({ ownerships: [{ npi: OWNED, state }] });

      await expect(viewerOwnsNpi(OWNED)).resolves.toBe(false);
    },
  );

  it('refuses an NPI the caller has not claimed at all', async () => {
    backendReturns({ ownerships: [{ npi: OWNED, state: 'verified' }] });

    await expect(
      viewerOwnsNpi(OTHER),
      'owning one NPI must not grant access to another',
    ).resolves.toBe(false);
  });
});

describe('fails closed on ambiguity', () => {
  it('refuses when the caller is not signed in', async () => {
    clerk.userId = null;
    backendReturns({ ownerships: [{ npi: OWNED, state: 'verified' }] });

    await expect(viewerOwnsNpi(OWNED)).resolves.toBe(false);
  });

  it('refuses when the backend is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );

    await expect(viewerOwnsNpi(OWNED)).resolves.toBe(false);
  });

  it('refuses on a non-200 from the backend', async () => {
    backendReturns({ ownerships: [{ npi: OWNED, state: 'verified' }] }, false, 503);

    await expect(viewerOwnsNpi(OWNED)).resolves.toBe(false);
  });

  it('refuses on an unparseable body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      })),
    );

    await expect(viewerOwnsNpi(OWNED)).resolves.toBe(false);
  });

  it.each([{}, { ownerships: null }, { ownerships: 'yes' }, { ownerships: [null] }])(
    'refuses an unexpected shape (%j)',
    async (body) => {
      backendReturns(body);

      await expect(viewerOwnsNpi(OWNED)).resolves.toBe(false);
    },
  );

  it('refuses a malformed NPI without calling the backend at all', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);

    await expect(viewerOwnsNpi('not-an-npi')).resolves.toBe(false);
    expect(spy, 'a malformed id must not reach the backend').not.toHaveBeenCalled();
  });
});
