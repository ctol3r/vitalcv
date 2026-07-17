import { auth } from '@clerk/nextjs/server';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

async function buildForwardHeaders(session: Awaited<ReturnType<typeof auth>>): Promise<Headers> {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${BACKEND}/api/workspaces/switch`, {
      method: 'POST',
      headers: await buildForwardHeaders(session),
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    const data = await upstream.json().catch(() => ({ error: `Upstream returned ${upstream.status}` })) as unknown;
    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Workspace switch failed', detail: String(error) },
      { status: 503 },
    );
  }
}
