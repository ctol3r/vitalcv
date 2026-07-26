/**
 * /api/auth/resolve-role — Clerk role resolution
 *
 * Called from the BROWSER by the /auth/resolving interstitial (which the
 * middleware redirects role-less-but-authenticated users to). It:
 *   1. Identifies the user from the verified Clerk session via auth() — NOT a
 *      caller-supplied header, so a browser cannot resolve anyone else's role.
 *   2. Fetches the primary email from Clerk (needed for first-time creation).
 *   3. Calls backend GET /api/me/role to upsert the User row and get the role.
 *   4. Mints the signed, short-lived `vitalcv_role` cookie and returns { role }.
 *
 * The middleware then reads that cookie on the follow-up navigation. This
 * replaces the old middleware->self-fetch fallback, which failed inside the
 * container (it could not reach its own public origin) and dead-ended every
 * first-time sign-in at /auth/error.
 */
import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { UserRole, type UserRoleType } from '@/lib/auth/roles';
import {
  ROLE_COOKIE_NAME,
  ROLE_COOKIE_TTL_SECONDS,
  signRoleCookie,
} from '@/lib/auth/roleCookie';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';

const VALID_ROLES = new Set<string>(Object.values(UserRole));

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://localhost:4000';

export async function GET() {
  // 1. Authenticated self only — identity comes from the verified session.
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // 2. Primary email so the backend can create a first-time user.
  let email: string | undefined;
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    email = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    )?.emailAddress;
  } catch {
    // Clerk fetch failed — proceed without email; existing users still resolve.
  }

  // 3. Resolve the role from the backend.
  let role: string;
  try {
    const headers: Record<string, string> = { ...(await buildIdentityHeaders({ userId })) };
    if (email) headers['x-clerk-user-email'] = email;

    const res = await fetch(`${BACKEND}/api/me/role`, { headers });
    if (!res.ok) {
      const body = await res.text();
      console.error('[resolve-role] backend error', res.status, body);
      return NextResponse.json({ error: 'Failed to resolve role' }, { status: 502 });
    }
    role = ((await res.json()) as { role: string }).role;
  } catch (err) {
    console.error('[resolve-role] backend unreachable', err);
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }

  // 4. Mint the signed role cookie so the middleware authorizes the follow-up
  //    navigation from the cookie fast path. Only sign a known role — never
  //    persist a garbage value that the middleware would reject and loop on.
  const out = NextResponse.json({ role });
  if (VALID_ROLES.has(role)) {
    const cookieValue = await signRoleCookie(role as UserRoleType);
    if (cookieValue) {
      out.cookies.set(ROLE_COOKIE_NAME, cookieValue, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: ROLE_COOKIE_TTL_SECONDS,
      });
    }
  }
  return out;
}
