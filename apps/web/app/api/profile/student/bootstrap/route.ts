/**
 * POST /api/profile/student/bootstrap
 * Student / no-NPI lane — proxy to backend. Starts a PREVIEW-ONLY profile
 * (self-attested, no NPI). Body: { attested?: boolean, attestationVersion?: string }.
 * Auth-scoped: forwards the verified Clerk identity (never a caller-supplied id).
 */
import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  await applyIdentityHeaders(headers, { userId: session.userId });
  // Forward the email claim so the backend can resolve/create the internal User
  // row on first touch (ensureWorkspaceUser), same as the NPI-bootstrap proxy.
  const emailClaim = (session.sessionClaims as Record<string, unknown> | undefined)?.email;
  if (typeof emailClaim === 'string' && emailClaim.length > 0) {
    headers.set('x-clerk-user-email', emailClaim);
  }

  const body = await req.text();
  const res = await fetch(`${BACKEND}/api/profile/student/bootstrap`, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
  return NextResponse.json(data, { status: res.status });
}
