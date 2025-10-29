import { NextRequest, NextResponse } from 'next/server';

/**
 * Request Issuer Attestation (Level 3)
 * POST /api/issuer/attest-request
 */

interface RequestBody {
  npi: string;
  userId?: string;
  holderDid?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { npi, userId, holderDid } = body;

    // Validate
    if (!npi || !/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: 'Invalid NPI' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Forward to backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/api/issuer/attest-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi, userId, holderDid }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Attestation Request Error]', error);
    return NextResponse.json({ error: 'Failed to request attestation' }, { status: 500 });
  }
}
