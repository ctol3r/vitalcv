/**
 * GET /api/runtime/ping
 *
 * Public liveness probe. No auth required.
 * Used by HydrationDiagnostics for upstream health checks.
 * Cache-Control: no-store
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { alive: true, ts: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
