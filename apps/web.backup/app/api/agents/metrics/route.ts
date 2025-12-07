import { NextRequest, NextResponse } from 'next/server';

const COMPLIANCE_API_BASE = process.env.COMPLIANCE_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4004';
const AGENTS_API_BASE = process.env.AGENTS_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

/**
 * Proxy endpoint for agent metrics
 * GET /api/agents/metrics
 */
export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${AGENTS_API_BASE}/metrics/agents`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch agent metrics' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Agent metrics proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent metrics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

