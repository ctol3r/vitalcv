import { NextResponse } from 'next/server';

/**
 * GET /api/verifier/dashboard/overview
 * Returns dashboard overview metrics
 */

export async function GET() {
  try {
    // TODO: Integrate with actual backend
    // For now, return mock data
    const overview = {
      totalProviders: 0,
      activeCredentials: 0,
      expiringSoon: 0,
      pendingVerification: 0,
      complianceAlerts: 0,
      chainAnchors: {
        total: 0,
        stale: 0,
        valid: 0,
      },
      recentActivity: [],
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error('[dashboard][overview]', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard overview' },
      { status: 500 },
    );
  }
}

