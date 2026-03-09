import { getApiBase } from '@/lib/api';
import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND = getApiBase();

function buildForwardHeaders(session: Awaited<ReturnType<typeof auth>>): Headers {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  if (session.userId) {
    headers.set('x-clerk-user-id', session.userId);
  }

  const claims = session.sessionClaims as Record<string, unknown> | undefined;
  const email = typeof claims?.email === 'string' ? claims.email : undefined;
  const role = typeof claims?.role === 'string'
    ? claims.role
    : typeof claims?.org_role === 'string'
      ? claims.org_role
      : undefined;
  const orgId = typeof (session as { orgId?: unknown }).orgId === 'string'
    ? (session as { orgId: string }).orgId
    : undefined;

  if (email) {
    headers.set('x-clerk-user-email', email);
  }

  if (role) {
    headers.set('x-clerk-user-role', role);
  }

  if (orgId) {
    headers.set('x-org-id', orgId);
  }

  return headers;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const body = await req.text();

  const res = await fetch(`${BACKEND}/api/search/suggest`, {
    method: 'POST',
    headers: buildForwardHeaders(session),
    body,
    signal: AbortSignal.timeout(8000),
  });

  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
