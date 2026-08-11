/**
 * Wave 244 — Employer Decision Capsules: GET proxy
 * GET /api/employer/decisions
 * Returns recent Decision Capsules for the verifier's org.
 *
 * Identity comes from the Clerk session on THIS server, never from the incoming
 * request. The previous version copied every `x-clerk-*` header off the caller
 * and forwarded it, which had two consequences:
 *
 *  - the browser does not send those headers, so the only real caller
 *    (components/decisions/RecentDecisionsPanel.tsx) forwarded nothing and the
 *    panel took a permanent 401 — the surface was dead;
 *  - anything that DID set them was believed, which is the defect this proxy
 *    must not participate in.
 *
 * `buildIdentityHeaders` attaches the `x-clerk-user-id` + `Authorization` pair
 * from the verified session, so this survives the CLERK_JWT_VERIFICATION
 * enforce flip rather than breaking on it.
 */
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET() {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Sign in to view decisions.' }, { status: 401 });
  }

  try {
    const headers = await buildIdentityHeaders({ userId: session.userId });
    const res = await fetch(`${B}/api/employer/decisions`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = typeof payload?.error === 'string' ? payload.error : 'Failed to fetch decisions';
      return NextResponse.json({ error: errorMsg }, { status: res.status });
    }

    return NextResponse.json(payload ?? {}, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
