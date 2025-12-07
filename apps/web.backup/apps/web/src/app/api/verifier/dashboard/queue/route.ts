import { NextResponse } from 'next/server';

/**
 * GET /api/verifier/dashboard/queue
 * Returns verification queue items
 */

export async function GET() {
  try {
    // TODO: Integrate with actual backend
    const items = [];

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[dashboard][queue]', error);
    return NextResponse.json(
      { error: 'Failed to fetch verification queue' },
      { status: 500 },
    );
  }
}

