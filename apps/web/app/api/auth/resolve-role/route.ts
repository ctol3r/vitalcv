/**
 * /api/auth/resolve-role — Clerk role resolution proxy
 *
 * Called by middleware.ts when a Clerk session has no vitalcv.role JWT claim
 * (i.e., first-time users or users whose JWT hasn't refreshed yet).
 *
 * Flow:
 *   1. Reads x-clerk-user-id from request headers (forwarded by middleware)
 *   2. Fetches primary email from Clerk (needed for user creation)
 *   3. Calls backend GET /api/me/role to upsert User + return role
 *   4. Returns { role: UserRole }
 *
 * Security: This route is only called server-side from middleware (same origin).
 * It never exposes credentials or session data to the browser.
 */
import { clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://localhost:4000';

export async function GET(req: NextRequest) {
  const clerkUserId = req.headers.get('x-clerk-user-id');

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Missing x-clerk-user-id' }, { status: 400 });
  }

  // Fetch primary email from Clerk so backend can create the user if needed
  let email: string | undefined;
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(clerkUserId);
    email = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    )?.emailAddress;
  } catch {
    // Clerk fetch failed — proceed without email.
    // ensureWorkspaceUser will still succeed for existing users.
  }

  // Call backend to ensure User row exists and get their role
  try {
    const headers: Record<string, string> = {
      'x-clerk-user-id': clerkUserId,
    };
    if (email) {
      headers['x-clerk-user-email'] = email;
    }

    const res = await fetch(`${BACKEND}/api/me/role`, { headers });

    if (!res.ok) {
      const body = await res.text();
      console.error('[resolve-role] backend error', res.status, body);
      return NextResponse.json({ error: 'Failed to resolve role' }, { status: 502 });
    }

    const data = (await res.json()) as { role: string; userId: string };
    return NextResponse.json({ role: data.role });
  } catch (err) {
    console.error('[resolve-role] backend unreachable', err);
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
