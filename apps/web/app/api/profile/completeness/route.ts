import { auth } from '@clerk/nextjs/server';
import { getApiBase } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

const BACKEND = getApiBase();

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = `${BACKEND}/api/profile/completeness`;
  const headers: Record<string, string> = {
    ...(await buildIdentityHeaders({ userId: session.userId })),
  };
  const res = await fetch(url, { method: 'GET', headers });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
