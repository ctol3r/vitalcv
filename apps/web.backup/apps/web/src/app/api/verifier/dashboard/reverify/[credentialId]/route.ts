import { NextResponse } from 'next/server';

/**
 * POST /api/verifier/dashboard/reverify/[credentialId]
 * Instant chain re-verify for flagged credentials
 */

export async function POST(
  request: Request,
  { params }: { params: { credentialId: string } },
) {
  try {
    const { credentialId } = params;

    // TODO: Integrate with actual backend chain verification
    console.log('Re-verify credential:', credentialId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[dashboard][reverify]', error);
    return NextResponse.json(
      { error: 'Failed to reverify credential' },
      { status: 500 },
    );
  }
}

