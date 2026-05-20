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
import { checkCorsAllowlist, getAllowedOrigins } from '@/lib/security/corsAllowlist';
import {
  ANTIGRAVITY_COOKIE_ACTIVE_RECEIPT,
  ANTIGRAVITY_COOKIE_RECEIPT_STATUS,
  evaluateAntigravityRoute,
  type AntigravityRole,
  type ReceiptStatus,
} from '@/lib/auth/antigravity';

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

/**
 * Antigravity routing check — WAVE C73.
 *
 * If the request carries an `vcv_active_receipt` cookie, the session
 * is a verifier-with-active-receipt and any drift onto a non-canonical
 * path (dashboards, generic landing pages, mutation surfaces while the
 * receipt is in a terminal status) is 307-redirected back to the
 * receipt URL. Pure decision; logic lives in `lib/auth/antigravity.ts`.
 *
 * Runs before public-route pass-through so verifier-blocked paths
 * (e.g. `/dashboard`) cannot leak through even when marked public.
 */
function applyAntigravity(
  req: NextRequest,
  role: AntigravityRole,
): NextResponse | null {
  const activeReceiptId =
    req.cookies.get(ANTIGRAVITY_COOKIE_ACTIVE_RECEIPT)?.value ?? null;
  if (!activeReceiptId) return null;
  const status =
    (req.cookies.get(ANTIGRAVITY_COOKIE_RECEIPT_STATUS)?.value as ReceiptStatus | undefined) ?? null;
  const decision = evaluateAntigravityRoute({
    role,
    pathname: req.nextUrl.pathname,
    activeReceiptId,
    receiptStatus: status,
  });
  if (decision.action !== 'redirect' || !decision.redirectTo) return null;
  const url = req.nextUrl.clone();
  url.pathname = decision.redirectTo;
  url.search = '';
  const res = NextResponse.redirect(url, 307);
  res.headers.set('x-antigravity-reason', decision.reason ?? 'unknown');
  return res;
}

const clerkHandler = clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // 0. Antigravity check — if a verifier is off-canonical, redirect first.
  //    Role from JWT if present; cookie presence is the active-session signal.
  {
    const earlySession = await auth();
    const earlyRole = (earlySession.sessionClaims?.vitalcv?.role as
      | UserRoleType
      | undefined) ?? null;
    const antigravity = applyAntigravity(req, earlyRole as AntigravityRole);
    if (antigravity) return antigravity;
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
