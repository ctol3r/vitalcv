import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { getApiBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function proxy(req: NextRequest, noteId: string, method: 'PATCH' | 'DELETE') {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const base = getApiBase();
  if (!base) {
    return NextResponse.json({ error: 'Garden storage is not configured.' }, { status: 503 });
  }
  try {
    const res = await fetch(`${base}/api/profile/garden/notes/${encodeURIComponent(noteId)}`, {
      method,
      headers: await buildMarketplaceHeaders(
        session,
        method === 'PATCH' ? { 'Content-Type': 'application/json' } : undefined,
      ),
      body: method === 'PATCH' ? await req.text() : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Garden storage is temporarily unavailable.' }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  return proxy(req, noteId, 'PATCH');
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  return proxy(req, noteId, 'DELETE');
}
