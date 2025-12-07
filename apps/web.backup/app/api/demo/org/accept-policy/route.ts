import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

/**
 * POST /api/demo/org/accept-policy
 * Accept organization policy
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, policyVersionId } = body;

    if (!orgId || !policyVersionId) {
      return NextResponse.json({ error: 'orgId and policyVersionId are required' }, { status: 400 });
    }

    const response = await fetch(`${BACKEND_URL}/api/demo/org/accept-policy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orgId, policyVersionId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to accept policy' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Accept Policy Error]', error);
    return NextResponse.json({ error: 'Failed to accept policy', message: error.message }, { status: 500 });
  }
}

