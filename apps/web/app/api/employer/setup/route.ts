import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
const B = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.text();
  const res = await fetch(`${B}/api/employer/setup`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-clerk-user-id': session.userId }, body });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
