import { NextResponse } from 'next/server';

/**
 * POST /api/verifier/dashboard/request-evidence
 * Request missing evidence from clinicians (push notification)
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { credentialIds } = body;

    // TODO: Integrate with actual backend and push notification service
    console.log('Request evidence:', { credentialIds });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[dashboard][request-evidence]', error);
    return NextResponse.json(
      { error: 'Failed to request evidence' },
      { status: 500 },
    );
  }
}

