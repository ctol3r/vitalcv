/**
 * Claim Status API - Returns current claim verification status
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock claim data store (in production, use database)
const claimStore = new Map();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const npi = searchParams.get('npi');

    if (!npi || !/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: 'Invalid NPI format' }, { status: 400 });
    }

    // Get or create claim status
    let claimStatus = claimStore.get(npi);

    if (!claimStatus) {
      // Return default unclaimed status
      claimStatus = {
        npi,
        level: 0,
        emailVerified: false,
        phoneVerified: false,
        documentsUploaded: false,
        selfieUploaded: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return NextResponse.json(claimStatus);
  } catch (error) {
    console.error('Claim status error:', error);
    return NextResponse.json({ error: 'Failed to get claim status' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { npi, ...updates } = body;

    if (!npi) {
      return NextResponse.json({ error: 'NPI is required' }, { status: 400 });
    }

    let claimStatus = claimStore.get(npi) || {
      npi,
      level: 0,
      emailVerified: false,
      phoneVerified: false,
      documentsUploaded: false,
      selfieUploaded: false,
      createdAt: new Date().toISOString(),
    };

    claimStatus = {
      ...claimStatus,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    claimStore.set(npi, claimStatus);

    return NextResponse.json(claimStatus);
  } catch (error) {
    console.error('Claim status update error:', error);
    return NextResponse.json({ error: 'Failed to update claim status' }, { status: 500 });
  }
}
