import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-url';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, context: { params: Promise<{ npi: string }> }) {
  const { npi } = await context.params;
  const downloadParam = req.nextUrl.searchParams.get('download');
  const upstreamUrl = new URL(`${BACKEND_URL}/api/export/${encodeURIComponent(npi)}`);
  if (downloadParam) upstreamUrl.searchParams.set('download', downloadParam);

  try {
    const res = await fetch(upstreamUrl.toString(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.text();
    const headers = new Headers();
    headers.set(
      'content-type',
      res.headers.get('content-type') ?? 'application/json; charset=utf-8',
    );
    const disposition = res.headers.get('content-disposition');
    if (disposition) headers.set('content-disposition', disposition);
    return new NextResponse(body, { status: res.status, headers });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'export_unreachable',
        detail: error instanceof Error ? error.message : 'Unknown upstream error',
      },
      { status: 502 },
    );
  }
}
