/**
 * /api/profile/sharing — career-profile visibility for the signed-in clinician.
 * GET returns { careerProfile: 'public' | 'private' }; POST sets it.
 * Thin auth-scoped proxy: identity comes from the verified Clerk session only.
 */
import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { getApiBase } from '@/lib/api';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

const BACKEND = getApiBase();

async function proxy(req: NextRequest, method: 'GET' | 'POST') {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await buildIdentityHeaders({ userId: session.userId })),
  };
  const res = await fetch(`${BACKEND}/api/profile/sharing`, {
    method,
    headers,
    body: method === 'POST' ? await req.text() : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({ error: 'Invalid response from backend' }));
  return NextResponse.json(data, { status: res.status });
}

export async function GET(req: NextRequest) {
  return proxy(req, 'GET');
}

export async function POST(req: NextRequest) {
  return proxy(req, 'POST');
}
