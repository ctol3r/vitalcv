import { auth } from '@clerk/nextjs/server';
import { getApiBase } from '@/lib/api';
import { type NextRequest, NextResponse } from 'next/server';

const BACKEND = getApiBase();

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = `${BACKEND}/api/profile/completeness`;
  const headers: Record<string, string> = {
    'x-clerk-user-id': session.userId,
  };
  const res = await fetch(url, { method: 'GET', headers });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
