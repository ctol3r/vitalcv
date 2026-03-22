import { NextResponse } from 'next/server';
import { getPublicDeployInfo } from '@/lib/deployInfo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/deploy-info
 *
 * Returns current deployment context for the footer LiveBadge and /updates page.
 * Public — contains no secrets.
 */
export function GET() {
  const info = getPublicDeployInfo();
  return NextResponse.json(info, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
