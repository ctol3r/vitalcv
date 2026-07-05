/**
 * POST /api/profile/identity/email-otp/verify  { email, code }
 * Proxy to backend — verifies an email-OTP identity-binding challenge.
 * Auth-scoped: forwards the verified Clerk user id (never a caller-supplied one).
 */
import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';

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
  headers.set('x-clerk-user-id', session.userId);

  const body = await req.text();
  const res = await fetch(`${BACKEND}/api/profile/identity/email-otp/verify`, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
  return NextResponse.json(data, { status: res.status });
}
