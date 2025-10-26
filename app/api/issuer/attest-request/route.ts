/**
 * Issuer Attestation Request API - Creates Level 3 attestation request
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock attestation request store
const attestationRequests = new Map();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { npi } = body;

    if (!npi || !/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: 'Invalid NPI format' }, { status: 400 });
    }

    // Generate request ID
    const requestId = `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const attestationRequest = {
      requestId,
      npi,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      level: 3,
    };

    attestationRequests.set(requestId, attestationRequest);

    console.log(`[Attestation Request] ${requestId} for NPI ${npi}`);

    // In production:
    // 1. Store request in database
    // 2. Notify issuers via webhook/queue
    // 3. Send email to requester with tracking info

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Attestation request submitted successfully',
    });
  } catch (error) {
    console.error('Attestation request error:', error);
    return NextResponse.json({ error: 'Failed to submit attestation request' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestId = searchParams.get('requestId');

    if (requestId) {
      const request = attestationRequests.get(requestId);
      if (!request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }
      return NextResponse.json(request);
    }

    // Return all pending requests for issuers
    const pending = Array.from(attestationRequests.values()).filter(
      (r: any) => r.status === 'pending',
    );

    return NextResponse.json({ requests: pending });
  } catch (error) {
    console.error('Get attestation requests error:', error);
    return NextResponse.json({ error: 'Failed to get attestation requests' }, { status: 500 });
  }
}
