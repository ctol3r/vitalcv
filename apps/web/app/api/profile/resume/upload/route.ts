import { auth } from '@clerk/nextjs/server';
import { getApiBase } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';
import { buildEmailHeader, buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

const BACKEND = getApiBase();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = `${BACKEND}/api/profile/resume/upload`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await buildIdentityHeaders({ userId: session.userId })),
    ...buildEmailHeader(session.sessionClaims as Record<string, unknown> | undefined),
  };
  const body = await req.text();
  const res = await fetch(url, { method: 'POST', headers, body });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
