import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import {
  isPublicRoute,
  getRequiredRole,
  getMismatchRedirect,
  type UserRoleType,
} from '@/lib/auth/roles';
import { ROLE_COOKIE_NAME, verifyRoleCookie } from '@/lib/auth/roleCookie';
import { isCanonicalProductionProcess } from '@/lib/deployment/canonicalProduction';
import { checkCorsAllowlist, getAllowedOrigins } from '@/lib/security/corsAllowlist';

/**
 * Role-based middleware for VitalCV.
 *
 * Role resolution order, first hit wins:
 *   1. Clerk JWT claim (session.sessionClaims.vitalcv.role) — the fast path
 *      once Clerk session-token customization is enabled.
 *   2. Signed `vitalcv_role` cookie — set by the resolver so subsequent
 *      requests skip the backend round-trip.
 *   3. Neither present → redirect to the /auth/resolving interstitial, which
 *      calls /api/auth/resolve-role from the BROWSER (reachable), mints the
 *      signed cookie, and returns the user here.
 *
 * Why the interstitial: the middleware must NOT server-fetch its own
 * `/api/auth/resolve-role` — that self-call fails inside the container (it
 * can't reach its own public origin), which dead-ended every first-time
 * sign-in at /auth/error even though the route itself works. Resolving from the
 * browser sidesteps container networking entirely.
 *
 * Intelligence and investigation API routes attempt Clerk but gracefully
 * degrade when Clerk edge processing fails (missing keys, timeout, etc.).
 * Route handlers use resolveIntelligenceAuthContext() which returns
 * missing_session when Clerk is unavailable.
 */

const isSignInPage = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

/**
 * API routes that should never 500 due to Clerk edge failures.
 * Clerk is attempted (so authenticated users get full data), but
 * failures are caught and the request passes through to route handlers.
 */
const INTELLIGENCE_API = /^\/api\/(intelligence|investigation)(\/.*)?$/;
const CLERK_MIDDLEWARE_ENABLED = Boolean(process.env.CLERK_SECRET_KEY);

const clerkHandler = clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // 1. Public routes pass through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // 2. Determine required role for this route
  const requiredRole = getRequiredRole(pathname);
  if (!requiredRole) {
    // Route is neither public nor protected — pass through
    return NextResponse.next();
  }

  // 3. Require authentication
  const session = await auth();
  if (!session.userId) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = '/sign-in';
    signInUrl.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // 4. Read role from JWT claim (fast path)
  let userRole: UserRoleType | undefined =
    session.sessionClaims?.vitalcv?.role as UserRoleType | undefined;

  // 4b. Read role from the signed cookie the resolver set on a prior request.
  //     Avoids the backend round-trip and works even though the JWT carries no
  //     role claim.
  if (!userRole) {
    const cookieRole = await verifyRoleCookie(
      req.cookies.get(ROLE_COOKIE_NAME)?.value,
    );
    if (cookieRole) userRole = cookieRole;
  }

  // 5. No role yet → hand off to the client-side resolver interstitial. It
  //    calls /api/auth/resolve-role from the browser, which mints the signed
  //    cookie, then returns the user to `redirect_url`. We never self-fetch
  //    resolve-role from here (that container self-call is what broke).
  if (!userRole) {
    const resolveUrl = req.nextUrl.clone();
    resolveUrl.pathname = '/auth/resolving';
    const target = `${pathname}${req.nextUrl.search}`;
    resolveUrl.search = '';
    resolveUrl.searchParams.set('redirect_url', target);
    return NextResponse.redirect(resolveUrl);
  }

  // 6. Enforce the role. AUTHENTICATED routes accept any signed-in user.
  if (requiredRole !== 'AUTHENTICATED' && userRole !== requiredRole) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = getMismatchRedirect(pathname, userRole);
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  // 7. Authorized — pass through.
  return NextResponse.next();
});

/**
 * Session-sensitive path prefixes (Wave 0.2). Every response under these —
 * pages, redirects, interstitials — is stamped `private, no-store` so no
 * shared cache (CDN, proxy, browser shared cache) can ever serve one user's
 * session-dependent output to another. The route trees also export
 * `dynamic = 'force-dynamic'`; this belt catches anything that slips the
 * segment config (new pages, redirects minted here in the middleware).
 */
const SESSION_PATH_PREFIXES = [
  '/onboarding',
  '/sign-in',
  '/sign-up',
  '/auth',
  '/holder',
  '/clinician',
  '/employer',
  '/review',
  '/apply',
] as const;

function isSessionPath(pathname: string): boolean {
  return SESSION_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function routeMiddleware(req: NextRequest, event: NextFetchEvent) {
  // CORS gate: /api/* routes require the Origin to be in the allowlist.
  // An absent ALLOWED_CORS_ORIGINS env var means the allowlist is empty and
  // all cross-origin API requests are blocked. Same-origin requests (no Origin
  // header) pass through — browsers omit Origin on same-origin fetches.
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin');
    if (origin !== null) {
      const cors = checkCorsAllowlist(origin, getAllowedOrigins());
      if (!cors.allowed) {
        return new NextResponse(null, {
          status: 403,
          headers: { 'x-cors-blocked': '1' },
        });
      }
    }
  }

  if (!CLERK_MIDDLEWARE_ENABLED) {
    if (isPublicRoute(req.nextUrl.pathname)) {
      return NextResponse.next();
    }

    const requiredRole = getRequiredRole(req.nextUrl.pathname);
    if (!requiredRole) {
      return NextResponse.next();
    }

    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = '/sign-in';
    signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (INTELLIGENCE_API.test(req.nextUrl.pathname)) {
    try {
      return await clerkHandler(req, event);
    } catch {
      // Clerk edge failed — pass through; route handlers degrade gracefully
      return NextResponse.next();
    }
  }
  return clerkHandler(req, event);
}

/**
 * Every deployment that is not canonical production is a second copy of the
 * public site on another hostname, so it refuses indexing outright.
 *
 * Resolved ONCE at module scope rather than per request: the value comes from
 * the container's own environment and cannot change between requests, and
 * `robots.ts` reads the same predicate. `X-Robots-Tag` is the half crawlers
 * actually obey — `robots.txt` alone does not stop an already-known URL from
 * being indexed.
 *
 * Set here, in the one place every response passes through, for the same
 * reason the cache-control header is: `routeMiddleware` has six exit paths and
 * a header added by hand would be missed on at least one of them.
 */
const REFUSE_INDEXING = !isCanonicalProductionProcess();

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const response = await routeMiddleware(req, event);
  if (response && isSessionPath(req.nextUrl.pathname)) {
    response.headers.set('Cache-Control', 'private, no-store');
  }
  if (response && REFUSE_INDEXING) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
