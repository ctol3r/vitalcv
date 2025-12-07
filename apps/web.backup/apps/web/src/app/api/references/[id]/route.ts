/**
 * Reference API Route
 * GET /api/references/[id] - Get a reference by ID
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');

    if (!base) {
      return NextResponse.json(
        { error: 'API base URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${base.replace(/\/$/, '')}/api/references/${id}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.message || `API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[references][get] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reference' },
      { status: 500 }
    );
  }
}

