import { NextRequest, NextResponse } from 'next/server';

const ISSUER_API_URL = process.env.ISSUER_API_URL || 'http://localhost:4001/oidc4vci';

export async function POST(request: NextRequest) {
  try {
    const { subjectDid, credentialType } = await request.json();

    // Call Issuer API to generate a pre-authorized code
    // In production, this would be an authenticated call (e.g. mTLS or API key)
    const response = await fetch(`${ISSUER_API_URL}/pre-authorized-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sink-id': 'svc.issuer-api', // Required by messaging guard
        'x-request-id': crypto.randomUUID(),
        'x-allowed-sinks': 'svc.issuer-api',
      },
      body: JSON.stringify({
        subjectDid,
        credentialType: credentialType || 'SDJWTPhysicianCredential',
        expiresInSeconds: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to get pre-auth code:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to initiate issuance' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Initiate issuance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
