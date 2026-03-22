import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET() {
  try {
    const upstream = await fetch(`${BACKEND}/api/analytics/funnel`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    return NextResponse.json(
      await upstream.json().catch(() => ({ error: 'Invalid analytics response' })),
      { status: upstream.status },
    );
  } catch {
    return NextResponse.json({ error: 'Analytics unavailable' }, { status: 503 });
  }
}
