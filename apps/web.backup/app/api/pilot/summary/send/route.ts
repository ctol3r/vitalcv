import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

/**
 * POST /api/pilot/summary/send
 * Trigger weekly pilot summary PDF generation
 */
export async function POST(_request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/pilot/summary/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to generate summary' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Pilot Summary Error]', error);
    return NextResponse.json(
      { error: 'Failed to generate pilot summary', message: error.message },
      { status: 500 },
    );
  }
}

