import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/health`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({ error: 'Invalid JSON from backend' }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'DEGRADED',
        timestamp: new Date().toISOString(),
        gitSha: 'unknown',
        error: 'Health check failed',
      },
      { status: 500 },
    );
  }
}
