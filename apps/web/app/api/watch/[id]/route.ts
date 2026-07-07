import { getApiBase } from '@/lib/api';
import { auth } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const res = await fetch(`${BACKEND}/api/watch/${encodeURIComponent(id)}${req.nextUrl.search}`, {
      signal: AbortSignal.timeout(8000),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 502 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await params;

  try {
    const res = await fetch(`${BACKEND}/api/watch/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await buildHeaders(session),
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 502 });
  }
}
