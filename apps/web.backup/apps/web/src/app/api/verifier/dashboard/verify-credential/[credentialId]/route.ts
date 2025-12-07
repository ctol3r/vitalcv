import { NextResponse } from 'next/server';

/**
 * POST /api/verifier/dashboard/verify-credential/[credentialId]
 * Instant verify credential
 */

export async function POST(
  request: Request,
  { params }: { params: { credentialId: string } },
) {
  try {
    const { credentialId } = params;

    // TODO: Integrate with actual backend verification
    console.log('Verify credential:', credentialId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[dashboard][verify-credential]', error);
    return NextResponse.json(
      { error: 'Failed to verify credential' },
      { status: 500 },
    );
  }
}

