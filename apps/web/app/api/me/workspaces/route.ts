import { auth, clerkClient } from '@clerk/nextjs/server';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

/**
 * The signed-in account's email. The session token carries no `email` claim on
 * this Clerk instance (no session-token customization), so the claim path was
 * null for every user — surfaces greeted "signed in as your account". Fall back
 * to the Clerk backend API, the same pattern resolve-role uses to create
 * first-time users.
 */
async function resolveAccountEmail(
  session: Awaited<ReturnType<typeof auth>>,
): Promise<string | null> {
  const emailClaim = (session.sessionClaims as Record<string, unknown> | undefined)?.email;
  if (typeof emailClaim === 'string' && emailClaim.length > 0) return emailClaim;
  if (!session.userId) return null;

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(session.userId);
    return (
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null
    );
  } catch {
    // Clerk fetch failed — the workspace payload still resolves without it.
    return null;
  }
}

async function buildForwardHeaders(
  session: Awaited<ReturnType<typeof auth>>,
  accountEmail: string | null,
): Promise<Headers> {
  const headers = new Headers();
  await applyIdentityHeaders(headers, { userId: session.userId });

  if (accountEmail) {
    headers.set('x-clerk-user-email', accountEmail);
  }

  return headers;
}

export async function GET() {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accountEmail = await resolveAccountEmail(session);

  try {
    const upstream = await fetch(`${BACKEND}/api/me/workspaces`, {
      headers: await buildForwardHeaders(session, accountEmail),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    const data = await upstream.json().catch(() => ({ error: `Upstream returned ${upstream.status}` })) as unknown;
    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    // Surface the signed-in email (from the Clerk session claim) to the client
    // gate so it can show "signed in as …". Additive; other callers ignore it.
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return NextResponse.json({ ...(data as Record<string, unknown>), accountEmail });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Workspace lookup unavailable', detail: String(error) },
      { status: 503 },
    );
  }
}
