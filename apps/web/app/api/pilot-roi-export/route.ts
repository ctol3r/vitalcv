import { type NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';
import { appendPilotFilterFromSource } from '@/lib/pilot/pilotKpiQuery';

export const runtime = 'nodejs';

const MONITORING_SECRET = process.env.MONITORING_SECRET?.trim() ?? '';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!MONITORING_SECRET) {
    return NextResponse.json({ error: 'MONITORING_SECRET not configured.' }, { status: 500 });
  }

  const params = new URLSearchParams();
  params.set('days', req.nextUrl.searchParams.get('days') ?? '90');
  appendPilotFilterFromSource(req.nextUrl.searchParams, params, 'backend');

  try {
    const upstream = await fetch(`${getBackendBase()}/api/internal/pilot/roi-report/html?${params.toString()}`, {
      headers: { 'x-monitoring-secret': MONITORING_SECRET },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: 'ROI export failed.' }, { status: upstream.status });
    }

    const html = await upstream.text();
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="vitalcv-roi-report.html"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Network failure during ROI export.' }, { status: 502 });
  }
}
