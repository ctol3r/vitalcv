import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

/**
 * GET /api/metrics-summary
 * Fetch SLO metrics summary from backend
 */
export async function GET(_request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/metrics-summary`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Always fetch fresh metrics
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to fetch metrics' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Metrics Summary Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics summary', message: error.message },
      { status: 500 },
    );
  }
}
