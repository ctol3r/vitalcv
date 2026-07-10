import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

/** GET /api/ownership/me — list caller's claimed NPIs */
export async function GET(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await fetch(`${B}/api/ownership/me`, {
    headers: { ...(await buildIdentityHeaders({ userId })) },
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
