/**
 * /api/pilot-ops/export — Unified KPI export proxy (JSON or CSV)
 *
 * Proxies to GET /api/pilot-ops/export on the backend,
 * injecting the MONITORING_SECRET server-side so it's never exposed in the browser.
 *
 * Query params:
 *   format=json|csv  (default: json)
 *   days=30|60|90    (default: 90)
 *   org, pilotId, lane, geo — scope filters
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';
import { appendPilotFilterFromSource } from '@/lib/pilot/pilotKpiQuery';

export const runtime = 'nodejs';

const MONITORING_SECRET = process.env.MONITORING_SECRET?.trim() ?? '';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!MONITORING_SECRET) {
    return NextResponse.json({ error: 'MONITORING_SECRET not configured.' }, { status: 500 });
  }

  const format = (req.nextUrl.searchParams.get('format') ?? 'json').toLowerCase();
  const params = new URLSearchParams();
  params.set('days', req.nextUrl.searchParams.get('days') ?? '90');
  params.set('format', format);
  appendPilotFilterFromSource(req.nextUrl.searchParams, params, 'backend');

  try {
    const upstream = await fetch(
      `${getBackendBase()}/api/pilot-ops/export?${params.toString()}`,
      {
        headers: { 'x-monitoring-secret': MONITORING_SECRET },
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Export failed.' }, { status: upstream.status });
    }

    const dateStamp = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const csv = await upstream.text();
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="vitalcv-pilot-ops-${dateStamp}.csv"`,
        },
      });
    }

    const payload = await upstream.json();
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="vitalcv-pilot-ops-${dateStamp}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Backend unreachable.' }, { status: 502 });
  }
}
