/**
 * `/career-map/:npi` guard — asserted through the REAL middleware.
 *
 * WHY THIS FILE EXISTS.
 *
 * `/career-map/[entityId]` is keyed by NPI and renders that clinician's career
 * knowledge graph. It appeared in neither PROTECTED_ROUTES nor
 * PUBLIC_ROUTE_PATTERNS, so the middleware's step 2 returned `null` for its
 * required role and passed the request through. Verified against production on
 * 2026-08-10: `GET https://vitalcv.com/career-map/1003000126` returned 200 to an
 * unauthenticated caller. Its whole `[entityId]` sibling family behaved the same
 * way (/ecosystem, /activity, /career-intelligence, /professional-growth,
 * /packet); this suite covers only the route this change gates.
 *
 * Following clinician-route-guard.test.ts, this asserts the OUTCOME an anonymous
 * visitor receives from the real middleware, not the contents of roles.ts.
 * Asking roles.ts what it thinks is how the equivalent hole stayed green before:
 * the list was the thing that was wrong, so a test reading the list recorded the
 * bug as the contract.
 *
 * Authentication is only the TURNSTILE. The scope — that this NPI belongs to the
 * caller — is enforced in the page via `viewerOwnsNpi`, covered by
 * career-map-ownership-scope.test.ts. Neither test is sufficient alone.
 */

import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { NextFetchEvent } from 'next/server';

const clerk = vi.hoisted(() => ({
  session: { userId: null as string | null, role: null as string | null },
}));

vi.mock('@clerk/nextjs/server', () => ({
  createRouteMatcher: () => () => false,
  clerkMiddleware:
    (
      handler: (
        auth: () => Promise<unknown>,
        req: NextRequest,
        event: NextFetchEvent,
      ) => unknown,
    ) =>
    (req: NextRequest, event: NextFetchEvent) =>
      handler(
        async () => ({
          userId: clerk.session.userId,
          sessionClaims: clerk.session.role
            ? { vitalcv: { role: clerk.session.role } }
            : undefined,
        }),
        req,
        event,
      ),
}));

process.env.CLERK_SECRET_KEY ||= 'sk_test_career_map_route_guard';

const { default: middleware } = await import('../middleware');

async function get(path: string, as: { userId?: string; role?: string } = {}) {
  clerk.session.userId = as.userId ?? null;
  clerk.session.role = as.role ?? null;
  const res = await middleware(
    new NextRequest(new URL(`https://vitalcv.com${path}`)),
    {} as NextFetchEvent,
  );
  const location = res?.headers.get('location');
  return {
    status: res?.status,
    redirectedTo: location ? new URL(location).pathname : null,
    redirectUrlParam: location ? new URL(location).searchParams.get('redirect_url') : null,
  };
}

const NPI = '1003000126';

describe('anonymous visitor to /career-map/:npi', () => {
  it('is redirected to sign-in rather than served the graph', async () => {
    const res = await get(`/career-map/${NPI}`);

    expect(
      res.redirectedTo,
      'an anonymous request for an NPI-keyed career graph must not be served it',
    ).toBe('/sign-in');
    expect(res.status).toBe(307);
  });

  it('is sent back to the map it asked for after signing in', async () => {
    const res = await get(`/career-map/${NPI}`);

    expect(res.redirectUrlParam).toBe(`/career-map/${NPI}`);
  });

  it('is gated on every NPI, not just one', async () => {
    for (const npi of ['1003000126', '1234567893', '9999999999']) {
      const res = await get(`/career-map/${npi}`);
      expect(res.redirectedTo, `${npi} must be gated`).toBe('/sign-in');
    }
  });
});

describe('signed-in visitor to /career-map/:npi', () => {
  it('passes the turnstile once a role is resolved', async () => {
    const res = await get(`/career-map/${NPI}`, { userId: 'user_1', role: 'CLINICIAN' });

    expect(res.redirectedTo, 'a signed-in caller must not be bounced to sign-in').not.toBe(
      '/sign-in',
    );
  });

  /**
   * The route is AUTHENTICATED, not CLINICIAN, on purpose: the role claim
   * resolves asynchronously via the /auth/resolving interstitial, and this route
   * is reached from links. Requiring a specific role would bounce legitimate
   * owners mid-resolution. Any signed-in role therefore clears the turnstile —
   * which is precisely why the ownership check in the page is load-bearing.
   */
  it('does not bounce a signed-in non-clinician role at the turnstile', async () => {
    const res = await get(`/career-map/${NPI}`, { userId: 'user_2', role: 'VERIFIER' });

    expect(res.redirectedTo).not.toBe('/sign-in');
  });
});
