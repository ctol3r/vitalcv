import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/worldid/status`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({ error: 'Invalid JSON from backend' }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('World ID status error:', error);
    return NextResponse.json({ configured: false, error: 'Failed to fetch World ID status' }, { status: 500 });
  }
}


