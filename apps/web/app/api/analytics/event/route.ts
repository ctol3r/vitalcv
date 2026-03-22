import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function POST(req: NextRequest) {
  try {
    const upstream = await fetch(`${BACKEND}/api/analytics/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: await req.text(),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    return NextResponse.json(
      await upstream.json().catch(() => ({ success: upstream.ok })),
      { status: upstream.status },
    );
  } catch {
    return NextResponse.json({ error: 'Analytics unavailable' }, { status: 503 });
  }
}
