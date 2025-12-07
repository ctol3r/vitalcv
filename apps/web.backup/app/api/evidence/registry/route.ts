import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

/**
 * GET /api/evidence/registry
 * Proxy to backend evidence registry API
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '';
    const queryString = searchParams.toString();

    // Build backend URL
    const backendPath = path || '/api/evidence/registry';
    const url = `${BACKEND_URL}${backendPath}${queryString ? `?${queryString.replace('path=', '')}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to fetch evidence' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Evidence Registry Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch evidence registry', message: error.message },
      { status: 500 },
    );
  }
}

