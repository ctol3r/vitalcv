import { NextResponse } from 'next/server';

/**
 * GET /api/verifier/dashboard/compliance-alerts
 * Returns compliance alerts
 */

export async function GET() {
  try {
    // TODO: Integrate with actual backend
    const alerts = [];

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('[dashboard][compliance-alerts]', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance alerts' },
      { status: 500 },
    );
  }
}

