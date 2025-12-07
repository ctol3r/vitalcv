import { NextResponse } from 'next/server';

/**
 * POST /api/verifier/dashboard/batch-verify
 * Batch verify selected credentials
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { credentialIds, providerIds } = body;

    // TODO: Integrate with actual backend
    console.log('Batch verify:', { credentialIds, providerIds });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[dashboard][batch-verify]', error);
    return NextResponse.json(
      { error: 'Failed to batch verify' },
      { status: 500 },
    );
  }
}

