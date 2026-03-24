/**
 * /api/pilot-kpi-export — CSV export proxy
 *
 * Proxies to GET /api/internal/pilot/kpis/export on the backend,
 * injecting the MONITORING_SECRET server-side so it's never exposed in the browser.
 *
 * This route itself is not secret — protect /pilot-ops at the infra level.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { appendPilotFilterFromSource } from '@/lib/pilot/pilotKpiQuery';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

const MONITORING_SECRET = process.env.MONITORING_SECRET ?? '';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = new URLSearchParams();
  params.set('days', req.nextUrl.searchParams.get('days') ?? '90');
  appendPilotFilterFromSource(req.nextUrl.searchParams, params, 'backend');

  if (!MONITORING_SECRET) {
    return NextResponse.json({ error: 'MONITORING_SECRET not configured.' }, { status: 500 });
  }

  try {
    const upstream = await fetch(
      `${B}/api/internal/pilot/kpis/export?${params.toString()}`,
      {
        headers: { 'x-monitoring-secret': MONITORING_SECRET },
        cache:   'no-store',
      },
    );

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Export failed.' }, { status: upstream.status });
    }

    const csv      = await upstream.text();
    const filename = `vitalcv-pilot-kpis-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Backend unreachable.' }, { status: 502 });
  }
}
