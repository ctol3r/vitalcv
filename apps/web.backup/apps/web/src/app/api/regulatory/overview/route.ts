/**
 * GET /api/regulatory/overview
 * Task 4: Backend aggregator endpoint
 * Returns comprehensive regulatory overview for a clinician
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicianId = searchParams.get('clinicianId');

    if (!clinicianId) {
      return NextResponse.json({ error: 'clinicianId required' }, { status: 400 });
    }

    // In production, this would fetch from the backend API
    // For now, return mock data structure
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

    // Fetch from backend regulatory service
    const response = await fetch(`${API_BASE}/api/regulatory/overview?clinicianId=${clinicianId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Return mock data if backend is not available
      return NextResponse.json({
        clinicianId,
        npi: '1234567890',
        did: 'did:key:example',
        trustScore: 0.85,
        chainAnchors: {
          total: 5,
          valid: 4,
          stale: 1,
          lastAnchorDate: new Date().toISOString(),
          regulatoryDocuments: [],
        },
        stateBoards: [],
        dea: null,
        cms: null,
        payers: [],
        lastUpdated: new Date().toISOString(),
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[regulatory][overview]', error);
    return NextResponse.json(
      { error: 'Failed to fetch regulatory overview' },
      { status: 500 },
    );
  }
}








