/**
 * POST /api/profile/npi/bootstrap
 * Wave 286: Proxy to backend — bootstraps NPI profile from NPPES.
 * Body: { npi: string }
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

  const headers = new Headers({ 'Content-Type': 'application/json' });
  // Inject Clerk session — required by backend requireUserId()
  if (session.userId) {
    await applyIdentityHeaders(headers, { userId: session.userId });
  }
  const emailClaim = (session.sessionClaims as Record<string, unknown> | undefined)?.email;
  if (typeof emailClaim === 'string' && emailClaim.length > 0) {
    headers.set('x-clerk-user-email', emailClaim);
  }

  const body = await req.text();
  const res = await fetch(`${BACKEND}/api/profile/npi/bootstrap`, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
  return NextResponse.json(data, { status: res.status });
}
