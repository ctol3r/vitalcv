import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

/** POST /api/ownership/claim — claim an NPI for the authenticated user */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.text();
  const res = await fetch(`${B}/api/ownership/claim`, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      ...(await buildIdentityHeaders({ userId })),
    },
    body,
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
