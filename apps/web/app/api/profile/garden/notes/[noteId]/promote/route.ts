import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { getApiBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Explicit promotion of a private note into a self-attested Living CV line.
 * The backend derives origin and provenance server-side; this proxy only
 * carries the clinician's reviewed wording.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const base = getApiBase();
  if (!base) {
    return NextResponse.json({ error: 'Garden storage is not configured.' }, { status: 503 });
  }
  const { noteId } = await params;
  try {
    const res = await fetch(
      `${base}/api/profile/garden/notes/${encodeURIComponent(noteId)}/promote`,
      {
        method: 'POST',
        headers: await buildMarketplaceHeaders(session, { 'Content-Type': 'application/json' }),
        body: await req.text(),
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      },
    );
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Garden storage is temporarily unavailable.' }, { status: 503 });
  }
}
