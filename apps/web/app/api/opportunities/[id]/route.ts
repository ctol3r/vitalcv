import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getBackendBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const qs = req.nextUrl.searchParams.toString();

  try {
    const response = await fetch(`${getBackendBase()}/api/opportunities/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
      headers: await buildMarketplaceHeaders(session, { 'Content-Type': 'application/json' }),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
