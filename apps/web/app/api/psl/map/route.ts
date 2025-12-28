import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const url = new URL(req.url);
    const minTier = url.searchParams.get('minTier');
    const response = await fetch(
      `${backendUrl}/psl/map${minTier ? `?minTier=${encodeURIComponent(minTier)}` : ''}`,
      { cache: 'no-store' },
    );
    const data = await response.json().catch(() => ({ error: 'Invalid JSON from backend' }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('PSL map error:', error);
    return NextResponse.json({ error: 'Failed to fetch PSL map' }, { status: 500 });
  }
}
