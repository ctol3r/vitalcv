import { NextRequest, NextResponse } from 'next/server';

/**
 * Get Claim Status
 * GET /api/claim/status?npi=1234567890
 */

interface ClaimStatus {
  npi: string;
  level: 0 | 1 | 2 | 3;
  issuerAttestTx: string | null;
  lastVerifiedAt: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const npi = searchParams.get('npi');

    if (!npi || !/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: 'Invalid NPI' }, { status: 400 });
    }

    // Fetch from backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/api/claim/status?npi=${npi}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const data = await response.json();

    const status: ClaimStatus = {
      npi: data.npi,
      level: data.level ?? 0,
      issuerAttestTx: data.issuerAttestTx ?? null,
      lastVerifiedAt: data.lastVerifiedAt ?? null,
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('[Claim Status Error]', error);
    return NextResponse.json({ error: 'Failed to fetch claim status' }, { status: 500 });
  }
}
