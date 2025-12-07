import { NextResponse } from 'next/server';

/**
 * GET /api/verifier/dashboard/chain-audit
 * Returns chain audit events
 */

export async function GET() {
  try {
    // TODO: Integrate with actual backend
    const events = [];

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[dashboard][chain-audit]', error);
    return NextResponse.json(
      { error: 'Failed to fetch chain audit events' },
      { status: 500 },
    );
  }
}

