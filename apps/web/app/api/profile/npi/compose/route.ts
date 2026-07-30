import { auth } from '@clerk/nextjs/server';
import { getApiBase } from '@/lib/api';
import { NextResponse } from 'next/server';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

const BACKEND = getApiBase();

export async function POST() {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await buildIdentityHeaders({ userId: session.userId })),
  };
  const response = await fetch(`${BACKEND}/api/profile/npi/compose`, {
    method: 'POST',
    headers,
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
