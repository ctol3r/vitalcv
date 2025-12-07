/**
 * B128C-FE-035: Frontend API route proxy for FHIR badge
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { npi: string } }
) {
  try {
    const { npi } = params;

    // Validate NPI format
    if (!npi || !/^\d{10}$/.test(npi)) {
      return NextResponse.json(
        { error: 'Invalid NPI format' },
        { status: 400 }
      );
    }

    // Fetch from backend API
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4006';
    const response = await fetch(`${backendUrl}/compliance/fhir-badge/${npi}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache for 5 minutes
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('FHIR badge API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch FHIR badge',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
