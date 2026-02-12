import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Routes that require authentication.
 *
 * - /verifier*  — employer credential staff console
 * - /admin*     — VitalCV operator pages (future)
 *
 * Public routes (no auth required):
 * - /           — landing page
 * - /holder*    — clinician trust-state viewer (read-only)
 * - /demo*      — demo pages
 * - /intake*    — clinician intake flow
 * - /preview*   — preview pages
 * - /sign-in*   — Clerk sign-in
 * - /sign-up*   — Clerk sign-up
 */
const isProtectedRoute = createRouteMatcher(['/verifier(.*)', '/admin(.*)']);

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function noopMiddleware(_req: NextRequest) {
  return NextResponse.next();
}

const handler = clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        await auth.protect();
      }
    })
  : noopMiddleware;

export default handler;

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
