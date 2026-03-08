import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

function buildForwardHeaders(session: Awaited<ReturnType<typeof auth>>): Headers {
  const headers = new Headers();
  headers.set('x-clerk-user-id', session.userId ?? '');

  const emailClaim = (session.sessionClaims as Record<string, unknown> | undefined)?.email;
  if (typeof emailClaim === 'string' && emailClaim.length > 0) {
    headers.set('x-clerk-user-email', emailClaim);
  }

  return headers;
}

export async function GET() {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const upstream = await fetch(`${BACKEND}/api/me/workspaces`, {
      headers: buildForwardHeaders(session),
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
      { error: 'Workspace lookup unavailable', detail: String(error) },
      { status: 503 },
    );
  }
}
