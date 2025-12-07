import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

/**
 * GET /api/pilot/health
 * Fetch pilot health metrics from backend
 */
export async function GET(_request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/pilot/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Always fetch fresh metrics
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to fetch pilot health' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Pilot Health Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch pilot health', message: error.message },
      { status: 500 },
    );
  }
}

