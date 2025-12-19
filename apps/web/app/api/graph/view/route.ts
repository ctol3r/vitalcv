import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const url = new URL(req.url);
    const limit = url.searchParams.get('limit');
    const response = await fetch(`${backendUrl}/graph/view${limit ? `?limit=${encodeURIComponent(limit)}` : ''}`, {
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({ error: 'Invalid JSON from backend' }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Graph view error:', error);
    return NextResponse.json({ error: 'Failed to fetch graph view' }, { status: 500 });
  }
}


