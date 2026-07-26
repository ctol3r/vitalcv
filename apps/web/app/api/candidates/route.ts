import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { BACKEND_URL as B } from '@/lib/backend-url';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();
  const res = await fetch(`${B}/api/candidates${qs ? '?' + qs : ''}`, { headers: { ...(await buildIdentityHeaders({ userId: session.userId })) } });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
