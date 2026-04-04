import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { BACKEND_URL as B } from '@/lib/backend-url';
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.text();
  const res = await fetch(`${B}/api/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-clerk-user-id': userId },
    body,
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
