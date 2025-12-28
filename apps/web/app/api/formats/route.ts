import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/formats.json`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({ error: 'Invalid JSON from backend' }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Formats registry error:', error);
    return NextResponse.json({ error: 'Failed to fetch formats registry' }, { status: 500 });
  }
}
