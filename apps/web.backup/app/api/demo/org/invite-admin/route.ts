import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

/**
 * POST /api/demo/org/invite-admin
 * Invite an admin to the organization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, orgId } = body;

    if (!email || !orgId) {
      return NextResponse.json({ error: 'Email and orgId are required' }, { status: 400 });
    }

    const response = await fetch(`${BACKEND_URL}/api/demo/org/invite-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, orgId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to invite admin' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Invite Admin Error]', error);
    return NextResponse.json({ error: 'Failed to invite admin', message: error.message }, { status: 500 });
  }
}

