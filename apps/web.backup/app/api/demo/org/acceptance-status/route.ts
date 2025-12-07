import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

/**
 * GET /api/demo/org/acceptance-status?orgId=...
 * Check if organization has accepted the current policy
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    // First get the current policy
    const policyResponse = await fetch(`${BACKEND_URL}/api/demo/policy`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!policyResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch policy' }, { status: policyResponse.status });
    }

    const policy = await policyResponse.json();

    // Check if org has accepted this policy version
    // This would typically be a separate endpoint, but for MVP we'll check via a query
    // For now, return that policy needs acceptance (frontend will handle the check)
    return NextResponse.json({
      orgId,
      policyVersionId: policy.id,
      hasAccepted: false, // This would be checked via a real endpoint
      policy,
    });
  } catch (error: any) {
    console.error('[Acceptance Status Error]', error);
    return NextResponse.json(
      { error: 'Failed to check acceptance status', message: error.message },
      { status: 500 }
    );
  }
}

