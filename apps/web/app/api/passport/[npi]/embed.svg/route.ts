import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  try {
    const { npi } = await params;
    const upstream = await fetch(`${BACKEND}/api/passport/${encodeURIComponent(npi)}/embed.svg`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'image/svg+xml; charset=utf-8',
        'Cache-Control': upstream.headers.get('cache-control') ?? 'public, max-age=3600',
      },
    });
  } catch {
    return new Response('', {
      status: 503,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
      },
    });
  }
}
