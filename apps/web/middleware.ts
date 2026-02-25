import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  isPublicRoute,
  getRequiredRole,
  getMismatchRedirect,
  ROLE_LANDING,
  type UserRoleType,
} from '@/lib/auth/roles';

/**
 * Role-based middleware for VitalCV.
 *
 * Fast path: reads role from Clerk JWT claim (publicMetadata.vitalcv.role).
 * Fallback: if no claim exists, calls /api/auth/resolve-role (Node runtime)
 *           to look up or create the User row in Prisma, then redirects to
 *           force a JWT refresh.
 *
 * /demo is permanently redirected (308) to /.
 */

const isSignInPage = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // 1. Permanent redirect: /demo -> /
  if (pathname === '/demo' || pathname.startsWith('/demo/')) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url, 308);
  }

  // 2. Public routes pass through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // 3. Determine required role for this route
  const requiredRole = getRequiredRole(pathname);
  if (!requiredRole) {
    // Route is neither public nor protected — pass through
    return NextResponse.next();
  }

  // 4. Require authentication
  const session = await auth();
  if (!session.userId) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = '/sign-in';
    signInUrl.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // 5. Read role from JWT claim (fast path)
  let userRole: UserRoleType | undefined =
    session.sessionClaims?.vitalcv?.role as UserRoleType | undefined;

  // 6. Fallback: no role claim in JWT
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

  // 7. Check role matches route
  if (userRole !== requiredRole) {
    const redirectPath = getMismatchRedirect(pathname, userRole);
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = redirectPath;
    return NextResponse.redirect(redirectUrl);
  }

  // 8. Authorized — pass through
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
