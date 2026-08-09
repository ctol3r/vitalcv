import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { getApiBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * WB-10 export proxy — clinician-private, identity from auth(), NOT a
 * caller-supplied header, matching every other garden proxy. Served as a
 * download: the export is the clinician's data leaving WITH them, on their
 * explicit request — the one sanctioned path out of the module besides
 * promotion.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const base = getApiBase();
  if (!base) {
    return NextResponse.json({ error: 'Garden storage is not configured.' }, { status: 503 });
  }
  try {
    const res = await fetch(`${base}/api/profile/garden/export`, {
      headers: await buildMarketplaceHeaders(session),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(payload, { status: res.status });
    }
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="vitalcv-workbench-export.json"',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Garden storage is temporarily unavailable.' }, { status: 503 });
  }
}
