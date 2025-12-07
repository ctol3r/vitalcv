import { NextResponse } from 'next/server';

/**
 * GET /api/verifier/dashboard/providers/[id]/credentials
 * Get provider credentials
 */

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    // TODO: Integrate with actual backend
    const credentials = [];

    return NextResponse.json({ credentials });
  } catch (error) {
    console.error('[dashboard][providers][id][credentials]', error);
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 },
    );
  }
}

