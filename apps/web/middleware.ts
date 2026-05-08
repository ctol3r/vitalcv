import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import {
  isPublicRoute,
  getRequiredRole,
  getMismatchRedirect,
  ROLE_LANDING,
  type UserRoleType,
} from '@/lib/auth/roles';
import {
  checkVerifierFailClosed,
  checkVerifierPermission,
  extractVerifierClaims,
  isVerifierApiRoute,
} from '@/lib/auth/orgInvitations';
import { checkCorsAllowlist, getAllowedOrigins } from '@/lib/security/corsAllowlist';

/**
 * Role-based middleware for VitalCV.
 *
 * Fast path: reads role from Clerk JWT claim (publicMetadata.vitalcv.role).
 * Fallback: if no claim exists, calls /api/auth/resolve-role (Node runtime)
 *           to look up or create the User row in Prisma, then redirects to
 *           force a JWT refresh.
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

  // ── Step 0 — Verifier API RBAC (Layer-1 of two-layer tenant isolation) ────
  //
  // Intercepts /api/verifier/* BEFORE the /api/* public-route pass-through
  // (PUBLIC_ROUTE_PATTERNS line for /api). Without this intercept, any /api/*
  // route is exempted from the role-gate flow below; verifier routes would
  // therefore inherit the public-default behavior and expose tenant data.
  //
  // LAYER 1 (this middleware):
  //   Validates the caller's JWT org_id matches the org they claim to
  //   represent via the `x-verifier-org` request header. Does NOT verify
  //   that the resource named by the URL belongs to that org.
  //
  // LAYER 2 (route handler — deferred to subsequent W2 PRs):
  //   Each /api/verifier/* route handler must additionally verify that
  //   the resource named by its URL parameters belongs to the
  //   requestingOrgId resolved here. Until Layer 2 lands per route, this
  //   middleware provides identity coherence only — not full resource
  //   ownership isolation.
  //
  // x-verifier-org is client-supplied. It is validated against the
  // Clerk-signed JWT org_id (timing-safe compare in Gate 2 of
  // checkVerifierPermission). It is NEVER accepted as a resource
  // ownership claim. See docs/ops/SECURITY_INVARIANTS.md §1.3, §2.4.
  if (isVerifierApiRoute(pathname)) {
    const session = await auth();
    if (!session.userId) {
      // 403 not 401: /api/* is in PUBLIC_ROUTE_PATTERNS so the standard
      // sign-in redirect path is not appropriate. The caller is asking for
      // a restricted resource without establishing identity.
      return new NextResponse(null, { status: 403 });
    }
    // W2-PR1A — runtime claim validation. Replaces the prior `as` cast
    // with full type-guarded extraction. Non-object vitalcv, non-string
    // org_id, empty org_id, unknown team_role all collapse to null →
    // Gate 1 fires → 403 no_org_context. No type assertion can mask a
    // malformed claim into permission.
    const { requestingOrgId, teamRole } = extractVerifierClaims(session.sessionClaims);
    const resourceOrgId = req.headers.get('x-verifier-org') ?? '';
    const decision = checkVerifierPermission({
      requestingOrgId,
      teamRole,
      resourceOrgId,
      method: req.method,
    });
    if (!decision.permitted) {
      return new NextResponse(null, { status: decision.statusCode });
    }
    return NextResponse.next();
  }

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

  // 5. Fallback: no role claim in JWT
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
      }
    } catch {
      // Fallback failed — redirect to error page (circuit breaker)
    }

    if (!userRole) {
      const errorUrl = req.nextUrl.clone();
      errorUrl.pathname = '/auth/error';
      return NextResponse.redirect(errorUrl);
    }

    // Redirect to role landing to force JWT refresh on next request
    const landingUrl = req.nextUrl.clone();
    landingUrl.pathname = ROLE_LANDING[userRole];
    return NextResponse.redirect(landingUrl);
  }

  // 6. Check role matches route
  //    AUTHENTICATED routes accept any authenticated user regardless of role
  if (requiredRole !== 'AUTHENTICATED' && userRole !== requiredRole) {
    const redirectPath = getMismatchRedirect(pathname, userRole);
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = redirectPath;
    return NextResponse.redirect(redirectUrl);
  }

  // 7. Authorized — pass through
  return NextResponse.next();
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

  // W2-PR1A — verifier-API fail-closed enforcement (security-critical).
  //
  // /api/verifier/* MUST never become public due to missing Clerk
  // configuration. Without this check, the !CLERK_MIDDLEWARE_ENABLED
  // branch below would evaluate isPublicRoute('/api/verifier/...'),
  // which returns true (because /api/* is in PUBLIC_ROUTE_PATTERNS as
  // a delegation contract), yielding NextResponse.next() and exposing
  // verifier routes publicly.
  //
  // checkVerifierFailClosed runs FIRST in the outer middleware so it
  // wins regardless of the Clerk-enabled / Clerk-disabled branch and
  // regardless of the INTELLIGENCE_API graceful-degrade catch.
  //
  // Returns 503 (Service Unavailable): auth infrastructure is not
  // available, no security decision can be made, the request is
  // dropped. The header `x-rbac-fail-closed: clerk_unavailable`
  // distinguishes this path from generic 503s for observability.
  const verifierFailClosed = checkVerifierFailClosed({
    pathname: req.nextUrl.pathname,
    clerkEnabled: CLERK_MIDDLEWARE_ENABLED,
  });
  if (verifierFailClosed.failClosed) {
    return new NextResponse(null, {
      status: verifierFailClosed.statusCode,
      headers: { 'x-rbac-fail-closed': verifierFailClosed.reason },
    });
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
