/**
 * Endorsement Request API Route
 * POST /api/endorsements/request - Create an endorsement request
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');

    if (!base) {
      return NextResponse.json(
        { error: 'API base URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${base.replace(/\/$/, '')}/api/endorsements/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
    console.error('[endorsements][request] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create endorsement request' },
      { status: 500 }
    );
  }
}

