import { NextResponse } from 'next/server';

/**
 * GET /api/verifier/dashboard/providers/[id]/evidence-pack
 * Get PSV evidence pack
 */

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    // TODO: Integrate with actual backend
    const evidencePack = {
      providerId: id,
      credentials: [],
    };

    return NextResponse.json(evidencePack);
  } catch (error) {
    console.error('[dashboard][providers][id][evidence-pack]', error);
    return NextResponse.json(
      { error: 'Failed to fetch evidence pack' },
      { status: 500 },
    );
  }
}

