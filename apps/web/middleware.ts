import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import {
  isPublicRoute,
  getRequiredRole,
  getMismatchRedirect,
  type UserRoleType,
} from '@/lib/auth/roles';
import {
  ROLE_COOKIE_NAME,
  ROLE_COOKIE_TTL_SECONDS,
  signRoleCookie,
  verifyRoleCookie,
} from '@/lib/auth/roleCookie';
import { checkCorsAllowlist, getAllowedOrigins } from '@/lib/security/corsAllowlist';

/**
 * Role-based middleware for VitalCV.
 *
 * Role resolution order, first hit wins:
 *   1. Clerk JWT claim (session.sessionClaims.vitalcv.role) — the fast path
 *      once Clerk session-token customization is enabled.
 *   2. Signed `vitalcv_role` cookie — set after a successful resolve so
 *      subsequent requests skip the backend round-trip.
 *   3. /api/auth/resolve-role backend fallback — upserts the User row and
 *      returns the role. On success we set the cookie and pass the request
 *      through (previously this redirected to ROLE_LANDING "to force a JWT
 *      refresh", which looped forever because the refreshed JWT still carried
 *      no role claim). On failure we redirect to /auth/error.
 *
 * Intelligence and investigation API routes attempt Clerk but gracefully
 * degrade when Clerk edge processing fails (missing keys, timeout, etc.).
 * Route handlers use resolveIntelligenceAuthContext() which returns
 * missing_session when Clerk is unavailable.
 */

/** Attach the signed, short-lived role cookie to an outgoing response. */
async function attachRoleCookie(
  res: NextResponse,
  role: UserRoleType,
): Promise<void> {
  const value = await signRoleCookie(role);
  if (!value) return;
  res.cookies.set(ROLE_COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ROLE_COOKIE_TTL_SECONDS,
  });
}

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

  // 4b. Read role from the signed cookie set by a prior resolve. Avoids the
  //     backend round-trip on every navigation and works even though the JWT
  //     carries no role claim.
  if (!userRole) {
    const cookieRole = await verifyRoleCookie(
      req.cookies.get(ROLE_COOKIE_NAME)?.value,
    );
    if (cookieRole) userRole = cookieRole;
  }

  // 5. Fallback: no role from JWT or cookie — resolve via backend.
  let resolvedViaFallback = false;
  if (!userRole) {
    try {
      const resolveUrl = new URL('/api/auth/resolve-role', req.nextUrl.origin);
      const resolveRes = await fetch(resolveUrl, {
        headers: {
          'x-clerk-user-id': session.userId,
        },
      });

      if (resolveRes.ok) {
        const data = await resolveRes.json();
        userRole = data.role as UserRoleType;
        resolvedViaFallback = Boolean(userRole);
      }
    } catch {
      // Fallback failed — fall through to the /auth/error circuit breaker.
    }

    if (!userRole) {
      const errorUrl = req.nextUrl.clone();
      errorUrl.pathname = '/auth/error';
      return NextResponse.redirect(errorUrl);
    }
  }

  // 6. Check role matches route, then build the response.
  //    AUTHENTICATED routes accept any authenticated user regardless of role.
  let res: NextResponse;
  if (requiredRole !== 'AUTHENTICATED' && userRole !== requiredRole) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = getMismatchRedirect(pathname, userRole);
    res = NextResponse.redirect(redirectUrl);
  } else {
    // 7. Authorized — pass through.
    res = NextResponse.next();
  }

  // 8. Persist the resolved role so the next request uses the cookie fast path
  //    instead of hitting the backend again (and never loops on a JWT refresh
  //    that will not carry the claim).
  if (resolvedViaFallback) {
    await attachRoleCookie(res, userRole);
  }

  return res;
});

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
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

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
