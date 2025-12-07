import { NextResponse } from 'next/server';

/**
 * GET /api/verifier/dashboard/providers
 * Returns provider list with trust scores and compliance status
 */

export async function GET() {
  try {
    // TODO: Integrate with actual backend
    const providers = [];

    return NextResponse.json({ providers });
  } catch (error) {
    console.error('[dashboard][providers]', error);
    return NextResponse.json(
      { error: 'Failed to fetch providers' },
      { status: 500 },
    );
  }
}

