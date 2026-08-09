/**
 * `/clinician/*` route guard — asserted through the REAL middleware.
 *
 * WHY THIS FILE EXISTS, AND WHY IT DOES NOT IMPORT roles.ts.
 *
 * `/clinician/profile` server-renders owner-scoped data (loadOwnerRecord
 * resolves the NPI linked to THIS account, then that clinician's CMS filing)
 * while appearing in neither PROTECTED_ROUTES nor PUBLIC_ROUTE_PATTERNS. The
 * middleware's step 2 therefore returned `null` for its required role and
 * passed the request through unauthenticated. Disclosed in review of #1225
 * (merged 4baa32b15); pre-existing rather than introduced by it.
 *
 * Nothing leaked: the page exports `dynamic = 'force-dynamic'` so it was never
 * statically cached, and the loader resolves identity via `auth()` and degrades
 * for a signed-out caller. This was a missing guard, not a live incident.
 *
 * The repo already had two tests covering this route and BOTH stayed green
 * while the hole was open, because both asserted a mechanism:
 *
 *   - holder-route-contract.test.ts asked roles.ts what it thought, and
 *     roles.ts was the thing that was wrong. It recorded `auth: 'passthrough'`
 *     — the bug, written down as the contract.
 *   - session-cache-contract.test.ts greps middleware.ts for the string
 *     `headers.set('Cache-Control', ...)`. That substring is present whether or
 *     not any given path ever reaches it.
 *
 * So this suite asserts the OUTCOME an anonymous visitor actually receives: it
 * calls the real `middleware` default export with a real NextRequest and looks
 * at the status, the Location, and the Cache-Control of the response that comes
 * back. It is deliberately blind to HOW that outcome is produced — moving the
 * route between the two lists, or renaming either list, cannot make it pass.
 */

import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { NextFetchEvent } from 'next/server';

/**
 * The session the mocked Clerk handler reports. Mutable so each case can set
 * the caller, and hoisted because `vi.mock` factories run before the file body.
 */
const clerk = vi.hoisted(() => ({
  session: { userId: null as string | null, role: null as string | null },
}));

/**
 * Clerk's edge SDK cannot run in a unit test, so `clerkMiddleware` is replaced
 * with a shim that invokes VitalCV's own handler — the closure holding steps
 * 1-7 — with a controllable `auth()`. Everything under test (the public check,
 * the role lookup, the sign-in redirect, the mismatch redirect, and the
 * Cache-Control belt wrapping all of them) is VitalCV code and runs for real.
 */
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

// `CLERK_MIDDLEWARE_ENABLED` is captured at module scope, so the key must exist
// before the import. Setting it exercises the Clerk branch — the one production
// actually takes — rather than the degraded no-Clerk fallback.
process.env.CLERK_SECRET_KEY ||= 'sk_test_clinician_route_guard';

const { default: middleware } = await import('../middleware');

/** Drive a GET through the middleware exactly as the edge runtime would. */
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
    cacheControl: res?.headers.get('cache-control'),
    /** Pathname of the redirect target, or null when nothing redirected. */
    redirectedTo: location ? new URL(location).pathname : null,
    redirectUrlParam: location
      ? new URL(location).searchParams.get('redirect_url')
      : null,
  };
}

describe('anonymous visitor to /clinician/profile', () => {
  it('is redirected to sign-in rather than served the page', async () => {
    const res = await get('/clinician/profile');

    expect(
      res.redirectedTo,
      'an anonymous request for an owner-scoped page must not be served it',
    ).toBe('/sign-in');
    expect(res.status).toBe(307);
  });

  it('is sent back to the page it asked for after signing in', async () => {
    const res = await get('/clinician/profile');

    expect(res.redirectUrlParam).toBe('/clinician/profile');
  });

  it('receives a response no shared cache may store', async () => {
    const res = await get('/clinician/profile');

    expect(res.cacheControl).toBe('private, no-store');
  });
});

describe('signed-in clinician to /clinician/profile', () => {
  it('is served the page', async () => {
    const res = await get('/clinician/profile', {
      userId: 'user_clinician',
      role: 'CLINICIAN',
    });

    expect(res.redirectedTo, 'the owner must still reach their own page').toBeNull();
    expect(res.status).toBe(200);
  });

  it('receives a response no shared cache may store', async () => {
    // The belt matters MOST on this path: the anonymous response is a redirect
    // with no body, while this one carries the clinician's own record.
    const res = await get('/clinician/profile', {
      userId: 'user_clinician',
      role: 'CLINICIAN',
    });

    expect(res.cacheControl).toBe('private, no-store');
  });
});

describe('signed-in non-clinician to /clinician/profile', () => {
  it('is redirected away from another role’s owner-scoped surface', async () => {
    const res = await get('/clinician/profile', {
      userId: 'user_employer',
      role: 'VERIFIER',
    });

    expect(res.redirectedTo).toBe('/employer/dashboard');
  });
});

/**
 * The guard is a PREFIX, so the fix is the route family rather than the one
 * page that disclosed it. `/clinician/profile` is the only sibling on disk
 * today; these cases pin the behaviour the next one will inherit, which is the
 * part a test written against the existing file tree would silently stop
 * covering the moment someone adds a page.
 */
describe('the guard covers the /clinician family, not just the one page', () => {
  it.each([
    '/clinician',
    '/clinician/credentials',
    '/clinician/profile/edit',
  ])('%s is guarded without being listed anywhere', async (path) => {
    const res = await get(path);

    expect(res.redirectedTo).toBe('/sign-in');
    expect(res.cacheControl).toBe('private, no-store');
  });
});

/**
 * `/clinicians` (plural) is a different, public surface — the same collision
 * that `/employers` vs `/employer` already documents in roles.ts. A guard
 * written as `startsWith('/clinician')` would swallow it, so the boundary is
 * pinned here rather than left to the next person to rediscover.
 */
describe('the plural marketing path is not caught by the guard', () => {
  it.each(['/clinicians', '/clinicians/how-it-works'])(
    '%s is not redirected to sign-in',
    async (path) => {
      const res = await get(path);

      expect(res.redirectedTo).not.toBe('/sign-in');
    },
  );
});
