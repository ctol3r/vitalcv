import { NextRequest, NextResponse } from 'next/server';

const COMPLIANCE_API_BASE = process.env.COMPLIANCE_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4004';

/**
 * Proxy endpoint for evidence export
 * GET /api/compliance/evidence/:providerId/export
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
  const { providerId } = params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';

  try {
    const response = await fetch(
      `${COMPLIANCE_API_BASE}/compliance/evidence/${providerId}/export?format=${format}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Evidence export proxy error:', error);
    return NextResponse.json(
      {
        error: 'export_failed',
        error_description: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

