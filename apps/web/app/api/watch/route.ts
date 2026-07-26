import { getApiBase } from '@/lib/api';
import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';

const BACKEND = getApiBase();

async function buildHeaders(session: Awaited<ReturnType<typeof auth>>): Promise<Headers> {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  if (session.userId) {
    await applyIdentityHeaders(headers, { userId: session.userId });
  }

  const orgId = typeof (session as { orgId?: unknown }).orgId === 'string'
    ? (session as { orgId: string }).orgId
    : undefined;
  if (orgId) {
    headers.set('x-org-id', orgId);
  }

  return headers;
}

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/watch`, {
      signal: AbortSignal.timeout(8000),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();

  try {
    const body = await req.text();
    const res = await fetch(`${BACKEND}/api/watch`, {
      method: 'POST',
      headers: await buildHeaders(session),
      body,
      signal: AbortSignal.timeout(8000),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 502 });
  }
}
