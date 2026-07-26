import { auth } from '@clerk/nextjs/server';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

async function buildForwardHeaders(session: Awaited<ReturnType<typeof auth>>): Promise<Headers> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  await applyIdentityHeaders(headers, { userId: session.userId });

  const emailClaim = (session.sessionClaims as Record<string, unknown> | undefined)?.email;
  if (typeof emailClaim === 'string' && emailClaim.length > 0) {
    headers.set('x-clerk-user-email', emailClaim);
  }

  return headers;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const upstream = await fetch(`${BACKEND}/api/clinician/activate`, {
      method: 'POST',
      headers: await buildForwardHeaders(session),
      body: await req.text(),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });

    const data = await upstream.json().catch(() => ({ error: 'Invalid response from backend' }));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
