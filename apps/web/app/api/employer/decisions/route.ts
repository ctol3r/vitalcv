/**
 * Wave 244 — Employer Decision Capsules: GET proxy
 * GET /api/employer/decisions
 * Returns recent Decision Capsules for the verifier's org.
 *
 * S1 — this proxy used to copy every inbound `x-clerk-*` header to the backend,
 * and the backend route resolved the caller's ORGANISATION from that header.
 * Since `x-clerk-user-id` is caller-supplied, anyone who knew a member's Clerk
 * id could read that org's decision capsules through this origin. Identity is
 * now derived from the Clerk session and paired with the verifiable bearer; the
 * backend half of the closure is `requireVerifiedClerkUserId` in
 * apps/api/backend/src/routes/decisionCapsules.ts, which is what actually stops
 * the same forgery arriving directly at api.vitalcv.com.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const headers = await buildIdentityHeaders({ userId: session.userId });

  try {
    const res = await fetch(`${B}/api/employer/decisions`, { headers });
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
