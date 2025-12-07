/**
 * Reference Request Get API Route
 * GET /api/references/request/[token] - Get reference request by token
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');

    if (!base) {
      return NextResponse.json(
        { error: 'API base URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${base.replace(/\/$/, '')}/api/references/request/${token}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.error || error.message || `API returned ${response.status}`, expired: error.expired },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[references][request-get] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reference request' },
      { status: 500 }
    );
  }
}

