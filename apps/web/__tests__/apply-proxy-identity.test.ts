/**
 * S1 — server-derived identity on the five proxies that used to blind-forward
 * `x-clerk-*` from the caller.
 *
 * Each of these route handlers previously did:
 *
 *   req.headers.forEach((v, k) => { if (k.startsWith('x-clerk-')) headers[k] = v; });
 *
 * `x-clerk-user-id` is a plain request header. A browser, a fetch from any
 * origin the CORS policy allows, or curl can set it to any value, and the proxy
 * relayed that claim to the backend under this origin's name — so the property
 * these tests pin is: **what the caller says about who they are never reaches
 * the backend, and what the backend receives is the server-verified session
 * plus the bearer it can check.**
 *
 * The forged value below (`user_victim`) is what an attacker would send. If any
 * of these assertions can be made to pass while the route still copies inbound
 * headers, the test is worthless — which is why each case sends the forged
 * header AND asserts the upstream value is the session's, not the header's.
 *
 * `@/lib/auth/forwardIdentity` is deliberately NOT mocked: the bearer assertion
 * has to exercise the real helper, or it proves only that a stub was called.
 */
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));

import { GET as sharesGET } from '@/app/api/apply/shares/[npi]/route';
import { POST as sharePOST } from '@/app/api/apply/share/route';
import { DELETE as shareDELETE } from '@/app/api/apply/share/[shareId]/route';
import { POST as bundlePOST } from '@/app/api/apply/bundle/route';
import { GET as decisionsGET } from '@/app/api/employer/decisions/route';

const FORGED = { 'x-clerk-user-id': 'user_victim' };

function makeReq(url: string, init: RequestInit = {}): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

function upstreamHeaders(spy: ReturnType<typeof vi.fn>): Headers {
  const [, init] = spy.mock.calls[0] as [string, RequestInit];
  return new Headers(init?.headers as HeadersInit);
}

function signedIn() {
  authMock.mockResolvedValue({
    userId: 'user_session',
    getToken: async () => 'jwt-session',
  });
}

function signedOut() {
  authMock.mockResolvedValue({ userId: null, getToken: async () => null });
}

/**
 * Every case is the same shape, so the table is the test: name, the invocation,
 * and nothing else. A sixth blind-forward proxy added later fails here the
 * moment someone adds its row — and is invisible if they don't, which is what
 * the header-trust ratchet is for on the backend side.
 */
const CASES: Array<{ name: string; call: () => Promise<Response> }> = [
  {
    name: 'GET /api/apply/shares/[npi]',
    call: () =>
      sharesGET(makeReq('http://localhost/api/apply/shares/1234567893', { headers: FORGED }), {
        params: Promise.resolve({ npi: '1234567893' }),
      }) as unknown as Promise<Response>,
  },
  {
    name: 'POST /api/apply/share',
    call: () =>
      sharePOST(
        makeReq('http://localhost/api/apply/share', {
          method: 'POST',
          headers: { ...FORGED, 'Content-Type': 'application/json' },
          body: JSON.stringify({ npi: '1234567893' }),
        }),
      ) as unknown as Promise<Response>,
  },
  {
    name: 'DELETE /api/apply/share/[shareId]',
    call: () =>
      shareDELETE(
        makeReq('http://localhost/api/apply/share/share_1', { method: 'DELETE', headers: FORGED }),
        { params: Promise.resolve({ shareId: 'share_1' }) },
      ) as unknown as Promise<Response>,
  },
  {
    name: 'POST /api/apply/bundle',
    call: () =>
      bundlePOST(
        makeReq('http://localhost/api/apply/bundle', {
          method: 'POST',
          headers: { ...FORGED, 'Content-Type': 'application/json' },
          body: JSON.stringify({ npi: '1234567893' }),
        }),
      ) as unknown as Promise<Response>,
  },
  {
    name: 'GET /api/employer/decisions',
    call: () =>
      decisionsGET(
        makeReq('http://localhost/api/employer/decisions', { headers: FORGED }),
      ) as unknown as Promise<Response>,
  },
];

describe('S1 — apply/decisions proxies derive identity server-side', () => {
  const realFetch = global.fetch;

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    global.fetch = realFetch;
  });

  for (const { name, call } of CASES) {
    describe(name, () => {
      it('ignores a client-set x-clerk-user-id and forwards the session identity', async () => {
        signedIn();
        const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
        global.fetch = fetchSpy as unknown as typeof fetch;

        await call();

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const headers = upstreamHeaders(fetchSpy);
        expect(headers.get('x-clerk-user-id')).toBe('user_session');
        expect(headers.get('x-clerk-user-id')).not.toBe('user_victim');
      });

      it('sends an Authorization bearer alongside the identity header', async () => {
        signedIn();
        const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
        global.fetch = fetchSpy as unknown as typeof fetch;

        await call();

        expect(upstreamHeaders(fetchSpy).get('authorization')).toBe('Bearer jwt-session');
      });

      it('401s an anonymous caller who supplies the header, and never calls the backend', async () => {
        signedOut();
        const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
        global.fetch = fetchSpy as unknown as typeof fetch;

        const res = await call();

        expect(res.status).toBe(401);
        expect(fetchSpy).not.toHaveBeenCalled();
      });
    });
  }
});
