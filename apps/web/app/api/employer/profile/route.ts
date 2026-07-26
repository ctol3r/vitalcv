import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { BACKEND_URL as B } from '@/lib/backend-url';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';
export async function GET() {
  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const res = await fetch(`${B}/api/employer/profile`, { headers: { ...(await buildIdentityHeaders({ userId: session.userId })) } });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
