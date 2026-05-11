/**
 * Web-v2 middleware — sandbox auth gate.
 *
 * Mirrors the apps/web middleware pattern but with a smaller surface:
 * only /sign-in is public; everything else requires a Clerk session.
 *
 * If CLERK_SECRET_KEY is absent, the middleware is a no-op pass-through
 * — the sandbox runs unauthenticated rather than crashing. This is
 * the fail-closed-toward-development direction documented in CLAUDE.md
 * for the main app.
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';

const CLERK_MIDDLEWARE_ENABLED = Boolean(process.env.CLERK_SECRET_KEY);

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/_next(.*)',
  '/favicon.ico',
]);

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }
  const session = await auth();
  if (!session.userId) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = '/sign-in';
    signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
});

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  if (!CLERK_MIDDLEWARE_ENABLED) {
    return NextResponse.next();
  }
  return clerkHandler(req, event);
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
