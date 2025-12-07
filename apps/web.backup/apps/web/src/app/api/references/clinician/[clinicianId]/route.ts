/**
 * References by Clinician API Route
 * GET /api/references/clinician/[clinicianId] - Get all references for a clinician
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export async function GET(
  request: NextRequest,
  { params }: { params: { clinicianId: string } }
) {
  try {
    const { clinicianId } = params;
    const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');

    if (!base) {
      return NextResponse.json(
        { error: 'API base URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${base.replace(/\/$/, '')}/api/references/clinician/${clinicianId}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.error || error.message || `API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[references][clinician] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch references' },
      { status: 500 }
    );
  }
}

