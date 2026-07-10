import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { BACKEND_URL as B } from '@/lib/backend-url';

// Edit or close one of the signed-in employer's own openings. Forwards to the
// backend PATCH /api/opportunities/:id, which enforces org ownership. Mirrors
// the auth of the sibling employer/opportunities proxy (session userId → the
// x-clerk-user-id header the backend reads).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.text();
  const res = await fetch(`${B}/api/opportunities/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-clerk-user-id': session.userId },
    body,
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
