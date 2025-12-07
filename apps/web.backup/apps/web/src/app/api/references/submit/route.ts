/**
 * Reference Submit API Route
 * POST /api/references/submit - Submit a reference via secure token
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const body = await request.json();

    const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');

    if (!base) {
      return NextResponse.json(
        { error: 'API base URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${base.replace(/\/$/, '')}/api/references/submit?token=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
    console.error('[references][submit] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit reference' },
      { status: 500 }
    );
  }
}

