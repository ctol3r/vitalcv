/**
 * API Route: Get OID4VP Request by Session ID
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    const response = await fetch(`${BACKEND_URL}/api/oid4vp/request/${sessionId}`, {
      method: 'GET',
      headers: {
        // TODO: Add authentication headers
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Session not found' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[OID4VP Get Request] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

