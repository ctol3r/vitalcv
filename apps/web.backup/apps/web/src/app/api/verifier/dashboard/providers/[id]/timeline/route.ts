import { NextResponse } from 'next/server';

/**
 * GET /api/verifier/dashboard/providers/[id]/timeline
 * Get chain-of-truth timeline
 */

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    // TODO: Integrate with actual backend
    const events = [];

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[dashboard][providers][id][timeline]', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline' },
      { status: 500 },
    );
  }
}

