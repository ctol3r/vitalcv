import { NextResponse } from 'next/server';

/**
 * GET /api/verifier/dashboard/providers/[id]
 * Get provider details
 */

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    // TODO: Integrate with actual backend
    const provider = {
      id,
      name: 'Provider Name',
      clinicianId: id,
    };

    return NextResponse.json(provider);
  } catch (error) {
    console.error('[dashboard][providers][id]', error);
    return NextResponse.json(
      { error: 'Failed to fetch provider' },
      { status: 500 },
    );
  }
}

